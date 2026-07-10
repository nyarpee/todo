"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type TransitionEvent as ReactTransitionEvent,
} from "react";
import type { TaskGroup, TaskGroupId } from "@/types/task";

export type GroupSwipePagerHandle = {
  // Programmatically slide to the adjacent group (used while dragging a task to
  // the edge). Returns false if there's no neighbour or a slide is already busy.
  slideTo: (direction: "prev" | "next") => boolean;
};

const START_THRESHOLD_PX = 12;
const COMMIT_RATIO = 0.42;
const FLICK_VELOCITY = 0.5; // px per ms
const SNAP_MS = 340;
const SNAP_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
const SOFT_RATIO = 0.55; // beyond this fraction of the width the drag gets heavy
const SOFT_GAIN = 0.5; // how much of the over-drag still moves the panel
const RUBBER_MAX_RATIO = 0.16; // max pull past the first/last group
const PAGE_GAP_PX = 20; // gutter shown between pages while swiping

type GroupSwipePagerProps = {
  orderedGroups: TaskGroup[];
  activeGroupId: TaskGroupId;
  disabled?: boolean;
  onChangeActiveGroup: (groupId: TaskGroupId) => void;
  renderGroup: (groupId: TaskGroupId, isActive: boolean) => ReactNode;
};

type Gesture = {
  pointerId: number;
  startX: number;
  startY: number;
  width: number;
  active: boolean;
  decided: boolean;
  lastX: number;
  lastT: number;
  velocity: number;
};

export const GroupSwipePager = forwardRef<GroupSwipePagerHandle, GroupSwipePagerProps>(function GroupSwipePager({
  orderedGroups,
  activeGroupId,
  disabled = false,
  onChangeActiveGroup,
  renderGroup,
}: GroupSwipePagerProps, ref) {
  const activeIndex = orderedGroups.findIndex((group) => group.id === activeGroupId);
  const centerGroup = activeIndex >= 0 ? orderedGroups[activeIndex] : undefined;
  const leftGroup = activeIndex > 0 ? orderedGroups[activeIndex - 1] : undefined;
  const rightGroup =
    activeIndex >= 0 && activeIndex < orderedGroups.length - 1 ? orderedGroups[activeIndex + 1] : undefined;

  const [offset, setOffset] = useState(0);
  const [animating, setAnimating] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const pendingCommitRef = useRef<TaskGroupId | null>(null);
  const rawDeltaRef = useRef(0);

  // Only swallow native scrolling while an actual horizontal page drag runs.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onTouchMove = (event: TouchEvent) => {
      if (gestureRef.current?.active) event.preventDefault();
    };
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => container.removeEventListener("touchmove", onTouchMove);
  }, []);

  function resistedOffset(dx: number, width: number): number {
    const towardLeft = dx > 0;
    const hasNeighbor = towardLeft ? Boolean(leftGroup) : Boolean(rightGroup);
    const sign = Math.sign(dx);
    const abs = Math.abs(dx);

    if (!hasNeighbor) {
      // Rubber-band at the ends: diminishing pull, always springs back.
      const max = width * RUBBER_MAX_RATIO;
      return sign * max * (1 - Math.exp(-abs / (width * 0.5)));
    }

    const soft = width * SOFT_RATIO;
    const eff = abs <= soft ? abs : soft + (abs - soft) * SOFT_GAIN;
    return sign * Math.min(eff, width + PAGE_GAP_PX);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled || pendingCommitRef.current) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const container = containerRef.current;
    if (!container) return;

    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      width: container.getBoundingClientRect().width || 1,
      active: false,
      decided: false,
      lastX: event.clientX,
      lastT: event.timeStamp,
      velocity: 0,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;

    if (!gesture.decided) {
      if (Math.abs(dx) < START_THRESHOLD_PX && Math.abs(dy) < START_THRESHOLD_PX) return;
      gesture.decided = true;
      if (Math.abs(dx) <= Math.abs(dy)) {
        // Vertical intent — let the list scroll and abandon paging.
        gestureRef.current = null;
        return;
      }
      gesture.active = true;
      setAnimating(false);
      try {
        containerRef.current?.setPointerCapture(event.pointerId);
      } catch {
        // capture may be unavailable; global listeners still track the move
      }
    }
    if (!gesture.active) return;

    const dt = event.timeStamp - gesture.lastT;
    if (dt > 0) gesture.velocity = (event.clientX - gesture.lastX) / dt;
    gesture.lastX = event.clientX;
    gesture.lastT = event.timeStamp;

    rawDeltaRef.current = dx;
    setOffset(resistedOffset(dx, gesture.width));
  }

  function endGesture(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    if (!gesture.active) return;

    try {
      containerRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      // already released
    }

    const width = gesture.width;
    const rawDx = rawDeltaRef.current;
    const velocity = gesture.velocity;
    const commitLeft =
      rawDx > 0 && leftGroup && (rawDx > width * COMMIT_RATIO || velocity > FLICK_VELOCITY);
    const commitRight =
      rawDx < 0 && rightGroup && (-rawDx > width * COMMIT_RATIO || -velocity > FLICK_VELOCITY);

    setAnimating(true);
    if (commitLeft && leftGroup) {
      pendingCommitRef.current = leftGroup.id;
      setOffset(width + PAGE_GAP_PX);
    } else if (commitRight && rightGroup) {
      pendingCommitRef.current = rightGroup.id;
      setOffset(-(width + PAGE_GAP_PX));
    } else {
      pendingCommitRef.current = null;
      setOffset(0);
    }
  }

  function handleTransitionEnd(event: ReactTransitionEvent<HTMLDivElement>) {
    // Only the panel's own transform settling — not a child row/progress bar.
    if (event.target !== event.currentTarget || event.propertyName !== "transform") return;

    const target = pendingCommitRef.current;
    setAnimating(false);
    if (!target) return;

    pendingCommitRef.current = null;
    // Reset to centre and hand the new group to the parent in one render, so the
    // committed panel (already on screen) stays put with no flash.
    setOffset(0);
    onChangeActiveGroup(target);
  }

  useImperativeHandle(
    ref,
    () => ({
      slideTo(direction) {
        if (pendingCommitRef.current) return false; // a slide is already running
        const container = containerRef.current;
        if (!container) return false;
        const width = container.getBoundingClientRect().width || 1;
        const target = direction === "prev" ? leftGroup : rightGroup;
        if (!target) return false;

        pendingCommitRef.current = target.id;
        setAnimating(true);
        setOffset(direction === "prev" ? width + PAGE_GAP_PX : -(width + PAGE_GAP_PX));
        return true;
      },
    }),
    [leftGroup, rightGroup],
  );

  const transition = animating ? `transform ${SNAP_MS}ms ${SNAP_EASING}` : "none";

  const panelStyle = (base: string): CSSProperties => ({
    transform: `translateX(calc(${base} + ${offset}px))`,
    transition,
  });

  if (!centerGroup) {
    return (
      <div className="groupPager">
        <div className="groupPagerPanel isCenter">{renderGroup(activeGroupId, true)}</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="groupPager"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
    >
      {leftGroup ? (
        <div className="groupPagerPanel isSide" key={leftGroup.id} style={panelStyle(`-100% - ${PAGE_GAP_PX}px`)}>
          {renderGroup(leftGroup.id, false)}
        </div>
      ) : null}

      <div
        className="groupPagerPanel isCenter"
        key={centerGroup.id}
        style={panelStyle("0px")}
        onTransitionEnd={handleTransitionEnd}
      >
        {renderGroup(centerGroup.id, true)}
      </div>

      {rightGroup ? (
        <div className="groupPagerPanel isSide" key={rightGroup.id} style={panelStyle(`100% + ${PAGE_GAP_PX}px`)}>
          {renderGroup(rightGroup.id, false)}
        </div>
      ) : null}
    </div>
  );
});
