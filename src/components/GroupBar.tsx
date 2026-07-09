"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { MoreVertical, Plus } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import type { TaskGroup, TaskGroupId } from "@/types/task";

const LONG_PRESS_DELAY_MS = 400;
const LONG_PRESS_MOVE_TOLERANCE_PX = 8;
const PRESS_SCALE = 1.08;
const DROP_ANIM_MS = 160;
const EDGE_SCROLL_ZONE_PX = 60;
const EDGE_SCROLL_MAX_SPEED_PX = 6.5;

type GroupBarProps = {
  groups: TaskGroup[];
  activeGroupId: TaskGroupId;
  onSelectGroup: (groupId: TaskGroupId) => void;
  onRegisterGroupChipsContainer?: ((element: HTMLDivElement | null) => void) | undefined;
  onRegisterGroupChip?: ((groupId: TaskGroupId, element: HTMLButtonElement | null) => void) | undefined;
  onAddGroup: () => void;
  onOpenMenu: () => void;
  onReorderGroups: (orderedGroupIds: TaskGroupId[]) => void;
};

type GestureState = {
  groupId: TaskGroupId;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  active: boolean;
  moved: boolean;
  initialRect: DOMRect | null;
};

export function GroupBar({
  groups,
  activeGroupId,
  onSelectGroup,
  onRegisterGroupChipsContainer,
  onRegisterGroupChip,
  onAddGroup,
  onOpenMenu,
  onReorderGroups,
}: GroupBarProps) {
  const { messages: text } = useLanguage();

  const [order, setOrder] = useState<TaskGroupId[]>(() => groups.map((group) => group.id));
  const [pressedGroupId, setPressedGroupId] = useState<TaskGroupId | null>(null);

  const orderRef = useRef(order);
  orderRef.current = order;

  const chipElementsRef = useRef(new Map<TaskGroupId, HTMLButtonElement>());
  const chipsContainerRef = useRef<HTMLDivElement | null>(null);
  const cloneRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<GestureState | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const dropAnimTimerRef = useRef<number | null>(null);
  const flipBeforeRectsRef = useRef<Map<TaskGroupId, DOMRect> | null>(null);
  const justReorderedRef = useRef(false);
  const latestPointerXRef = useRef<number | null>(null);
  const autoScrollRafRef = useRef<number | null>(null);
  const autoScrollDirRef = useRef<-1 | 0 | 1>(0);
  const autoScrollSpeedRef = useRef(0);

  // Keep the local order in sync with incoming groups, except mid-drag where the
  // local swaps are the source of truth until the gesture finishes.
  useEffect(() => {
    if (gestureRef.current?.active) return;
    const nextOrder = groups.map((group) => group.id);
    setOrder(nextOrder);
    orderRef.current = nextOrder;
  }, [groups]);

  // FLIP: after each swap, animate every in-flow chip from its previous slot to
  // its new one so the row slides smoothly.
  useLayoutEffect(() => {
    const beforeRects = flipBeforeRectsRef.current;
    if (!beforeRects) return;
    flipBeforeRectsRef.current = null;

    beforeRects.forEach((beforeRect, groupId) => {
      const element = chipElementsRef.current.get(groupId);
      if (!element) return;

      const afterRect = element.getBoundingClientRect();
      const deltaX = beforeRect.left - afterRect.left;
      if (Math.abs(deltaX) < 0.5) return;

      element.style.transition = "none";
      element.style.transform = `translateX(${deltaX}px)`;
      requestAnimationFrame(() => {
        element.style.transition = "transform 160ms ease";
        element.style.transform = "";
      });
    });
  }, [order]);

  // Position the floating clone at the chip's spot when a drag activates.
  useLayoutEffect(() => {
    if (!pressedGroupId) return;
    const clone = cloneRef.current;
    const rect = gestureRef.current?.initialRect;
    if (!clone || !rect) return;

    clone.style.transition = "none";
    clone.style.left = `${rect.left}px`;
    clone.style.top = `${rect.top}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.transform = `scale(${PRESS_SCALE})`;
  }, [pressedGroupId]);

  useEffect(() => {
    return () => {
      clearLongPressTimer();
      stopAutoScroll();
      if (dropAnimTimerRef.current !== null) {
        window.clearTimeout(dropAnimTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const orderedGroups = order
    .map((groupId) => groupsById.get(groupId))
    .filter((group): group is TaskGroup => group !== undefined);
  const missingGroups = groups.filter((group) => !order.includes(group.id));
  const displayGroups = [...orderedGroups, ...missingGroups];
  const pressedGroup = pressedGroupId
    ? groups.find((group) => group.id === pressedGroupId) ?? null
    : null;

  function clearLongPressTimer() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = null;
  }

  function activateReorder(groupId: TaskGroupId) {
    const gesture = gestureRef.current;
    const element = chipElementsRef.current.get(groupId);
    if (!gesture || gesture.groupId !== groupId || !element) return;

    gesture.active = true;
    gesture.initialRect = element.getBoundingClientRect();
    setPressedGroupId(groupId);
  }

  function swapOrder(fromIndex: number, toIndex: number) {
    const current = orderRef.current;
    const fromId = current[fromIndex];
    const toId = current[toIndex];
    if (fromId === undefined || toId === undefined) return;

    const next = current.slice();
    next[fromIndex] = toId;
    next[toIndex] = fromId;

    // Capture positions before the reorder so the FLIP effect can animate the gap.
    const beforeRects = new Map<TaskGroupId, DOMRect>();
    chipElementsRef.current.forEach((element, groupId) => {
      beforeRects.set(groupId, element.getBoundingClientRect());
    });
    flipBeforeRectsRef.current = beforeRects;

    // Keep the ref in sync immediately so rapid pointermoves in the same frame
    // don't double-swap off a stale order.
    orderRef.current = next;
    setOrder(next);
  }

  function maybeSwap(groupId: TaskGroupId, virtualCenterX: number) {
    const current = orderRef.current;
    const index = current.indexOf(groupId);
    if (index < 0) return;

    if (index < current.length - 1) {
      const rightId = current[index + 1];
      const rightElement = rightId ? chipElementsRef.current.get(rightId) : null;
      if (rightElement) {
        const rect = rightElement.getBoundingClientRect();
        if (virtualCenterX > rect.left + rect.width / 2) {
          swapOrder(index, index + 1);
          return;
        }
      }
    }

    if (index > 0) {
      const leftId = current[index - 1];
      const leftElement = leftId ? chipElementsRef.current.get(leftId) : null;
      if (leftElement) {
        const rect = leftElement.getBoundingClientRect();
        if (virtualCenterX < rect.left + rect.width / 2) {
          swapOrder(index, index - 1);
        }
      }
    }
  }

  // Virtual center X of the dragged chip in viewport coordinates: where the
  // finger has carried it, independent of how far the row has scrolled.
  function draggedChipCenterX(gesture: GestureState): number | null {
    const rect = gesture.initialRect;
    const pointerX = latestPointerXRef.current;
    if (!rect || pointerX === null) return null;
    return pointerX - gesture.startClientX + rect.left + rect.width / 2;
  }

  function stopAutoScroll() {
    if (autoScrollRafRef.current !== null) {
      cancelAnimationFrame(autoScrollRafRef.current);
    }
    autoScrollRafRef.current = null;
    autoScrollDirRef.current = 0;
    autoScrollSpeedRef.current = 0;
  }

  function updateAutoScroll(pointerX: number) {
    const container = chipsContainerRef.current;
    if (!container) {
      stopAutoScroll();
      return;
    }

    const rect = container.getBoundingClientRect();
    let direction: -1 | 0 | 1 = 0;
    let depth = 0;
    if (pointerX <= rect.left + EDGE_SCROLL_ZONE_PX) {
      direction = -1;
      depth = rect.left + EDGE_SCROLL_ZONE_PX - pointerX;
    } else if (pointerX >= rect.right - EDGE_SCROLL_ZONE_PX) {
      direction = 1;
      depth = pointerX - (rect.right - EDGE_SCROLL_ZONE_PX);
    }

    if (direction === 0) {
      stopAutoScroll();
      return;
    }

    // Ramp the speed by how deep the finger is into the edge zone (eased), so it
    // creeps near the boundary and only reaches full speed right at the edge.
    const intensity = Math.min(1, Math.max(0, depth / EDGE_SCROLL_ZONE_PX));
    autoScrollDirRef.current = direction;
    autoScrollSpeedRef.current = EDGE_SCROLL_MAX_SPEED_PX * intensity * intensity;
    if (autoScrollRafRef.current === null) {
      autoScrollRafRef.current = requestAnimationFrame(autoScrollTick);
    }
  }

  function autoScrollTick() {
    const container = chipsContainerRef.current;
    const gesture = gestureRef.current;
    const direction = autoScrollDirRef.current;

    if (!container || !gesture || !gesture.active || direction === 0) {
      stopAutoScroll();
      return;
    }

    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    const nextScrollLeft = Math.min(
      maxScrollLeft,
      Math.max(0, container.scrollLeft + direction * autoScrollSpeedRef.current),
    );
    container.scrollLeft = nextScrollLeft;

    // The finger is holding still at the edge while the row scrolls underneath,
    // so re-evaluate swaps against the newly revealed chip positions each frame.
    const centerX = draggedChipCenterX(gesture);
    if (centerX !== null) maybeSwap(gesture.groupId, centerX);

    autoScrollRafRef.current = requestAnimationFrame(autoScrollTick);
  }

  function handleGlobalPointerMove(event: PointerEvent) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    const dx = event.clientX - gesture.startClientX;
    const dy = event.clientY - gesture.startClientY;

    if (!gesture.active) {
      if (Math.abs(dx) > LONG_PRESS_MOVE_TOLERANCE_PX || Math.abs(dy) > LONG_PRESS_MOVE_TOLERANCE_PX) {
        gesture.moved = true;
        clearLongPressTimer();
      }
      return;
    }

    const clone = cloneRef.current;
    const rect = gesture.initialRect;
    if (!clone || !rect) return;

    latestPointerXRef.current = event.clientX;

    // Horizontal follow only — the clone's top stays pinned to the bar, so it can
    // never drift vertically out of view. Because the clone is position:fixed it
    // is never clipped by the chip row's overflow, even past the left/right edge.
    clone.style.transform = `translateX(${dx}px) scale(${PRESS_SCALE})`;

    maybeSwap(gesture.groupId, rect.left + dx + rect.width / 2);
    updateAutoScroll(event.clientX);
  }

  function handleGlobalPointerUp(event: PointerEvent) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    finishGesture();
  }

  // Latest-closure refs: the window listeners are attached once but always call
  // the current-render versions, so they read fresh props/state without churn.
  const globalMoveRef = useRef(handleGlobalPointerMove);
  const globalUpRef = useRef(handleGlobalPointerUp);
  globalMoveRef.current = handleGlobalPointerMove;
  globalUpRef.current = handleGlobalPointerUp;

  useEffect(() => {
    const move = (event: PointerEvent) => globalMoveRef.current(event);
    const up = (event: PointerEvent) => globalUpRef.current(event);
    // Chips use `touch-action: pan-x` so the row scrolls horizontally by default.
    // While a reorder drag is active we block that native scroll so the chip
    // follows the finger cleanly instead of the row scrolling underneath.
    const preventScrollWhileDragging = (event: TouchEvent) => {
      if (gestureRef.current?.active) event.preventDefault();
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("touchmove", preventScrollWhileDragging, { passive: false });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("touchmove", preventScrollWhileDragging);
    };
  }, []);

  function finishGesture() {
    const gesture = gestureRef.current;
    clearLongPressTimer();
    stopAutoScroll();
    latestPointerXRef.current = null;
    if (!gesture) return;

    if (gesture.active && gesture.initialRect) {
      justReorderedRef.current = true;
      window.setTimeout(() => {
        justReorderedRef.current = false;
      }, 0);

      // Settle the clone onto the placeholder's resting slot, then hand off.
      const clone = cloneRef.current;
      const placeholder = chipElementsRef.current.get(gesture.groupId);
      if (clone && placeholder) {
        const target = placeholder.getBoundingClientRect();
        const finalDx = target.left - gesture.initialRect.left;
        clone.style.transition = `transform ${DROP_ANIM_MS}ms ease`;
        clone.style.transform = `translateX(${finalDx}px) scale(1)`;
      }

      onReorderGroups(orderRef.current);

      if (dropAnimTimerRef.current !== null) {
        window.clearTimeout(dropAnimTimerRef.current);
      }
      dropAnimTimerRef.current = window.setTimeout(() => {
        dropAnimTimerRef.current = null;
        setPressedGroupId(null);
        gestureRef.current = null;
      }, DROP_ANIM_MS);
      return;
    }

    gestureRef.current = null;
  }

  function handleChipPointerDown(groupId: TaskGroupId, event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    clearLongPressTimer();
    gestureRef.current = {
      groupId,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      active: false,
      moved: false,
      initialRect: null,
    };

    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      activateReorder(groupId);
    }, LONG_PRESS_DELAY_MS);
  }

  function handleChipClick(groupId: TaskGroupId, event: ReactMouseEvent<HTMLButtonElement>) {
    if (justReorderedRef.current) {
      event.preventDefault();
      return;
    }
    onSelectGroup(groupId);
  }

  return (
    <section className="groupArea" aria-label={text.lists.area}>
      <div className="groupBarRow">
        <div
          ref={(element) => {
            chipsContainerRef.current = element;
            onRegisterGroupChipsContainer?.(element);
          }}
          className="groupChips"
        >
          {displayGroups.map((group) => (
            <GroupChip
              group={group}
              isActive={group.id === activeGroupId}
              isPlaceholder={group.id === pressedGroupId}
              key={group.id}
              onClick={handleChipClick}
              onPointerDown={handleChipPointerDown}
              refCallback={(element) => {
                if (element) {
                  chipElementsRef.current.set(group.id, element);
                } else {
                  chipElementsRef.current.delete(group.id);
                }
                onRegisterGroupChip?.(group.id, element);
              }}
            />
          ))}
        </div>

        <div className="groupBarActions">
          <button className="groupAddChip" type="button" onClick={onAddGroup} aria-label={text.lists.add}>
            <Plus size={16} aria-hidden="true" />
          </button>
          <button className="groupMenuButton" type="button" onClick={onOpenMenu} aria-label={text.lists.menu}>
            <MoreVertical size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {pressedGroup ? (
        <div
          ref={cloneRef}
          className={["groupChip", "groupChipDragClone", pressedGroup.id === activeGroupId ? "isActive" : ""]
            .filter(Boolean)
            .join(" ")}
          aria-hidden="true"
        >
          {pressedGroup.name}
        </div>
      ) : null}
    </section>
  );
}

type GroupChipProps = {
  group: TaskGroup;
  isActive: boolean;
  isPlaceholder: boolean;
  onClick: (groupId: TaskGroupId, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onPointerDown: (groupId: TaskGroupId, event: ReactPointerEvent<HTMLButtonElement>) => void;
  refCallback: (element: HTMLButtonElement | null) => void;
};

function GroupChip({ group, isActive, isPlaceholder, onClick, onPointerDown, refCallback }: GroupChipProps) {
  const className = ["groupChip", isActive ? "isActive" : "", isPlaceholder ? "isPlaceholder" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={refCallback}
      className={className}
      type="button"
      onClick={(event) => onClick(group.id, event)}
      onPointerDown={(event) => onPointerDown(group.id, event)}
    >
      {group.name}
    </button>
  );
}
