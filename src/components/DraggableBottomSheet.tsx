"use client";

import {
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type DraggableBottomSheetProps = {
  ariaLabel: string;
  className?: string;
  // Extra class on the fixed full-screen layer (not the sheet itself), e.g.
  // "composeSheetLayer" to pin compose-owned sheets above the detail sheet.
  layerClassName?: string;
  children: ReactNode;
  dismissOnBackdrop?: boolean;
  initialOffset?: number;
  showHandle?: boolean;
  onDismiss: () => boolean | void;
  // Parent-driven close animation: set `closing` to slide the sheet below the
  // viewport, and unmount it from `onClosed` once the slide has played.
  closing?: boolean;
  onClosed?: () => void;
};

export function DraggableBottomSheet({
  ariaLabel,
  className,
  layerClassName,
  children,
  dismissOnBackdrop = false,
  initialOffset = 0,
  showHandle = true,
  onDismiss,
  closing = false,
  onClosed,
}: DraggableBottomSheetProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [translateY, setTranslateY] = useState(initialOffset);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  // 0..1 once a held drag passes the release-would-dismiss threshold: the
  // sheet (and the backdrop dim) dissolve with the drag's depth, telling the
  // finger "release here and it closes". 0 while below the threshold.
  const [dragFadeProgress, setDragFadeProgress] = useState(0);
  const sheetRef = useRef<HTMLElement | null>(null);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const currentOffsetRef = useRef(initialOffset);
  const isTrackingPointerRef = useRef(false);
  const isDraggingRef = useRef(false);
  const didDragRef = useRef(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Latest onClosed without re-arming the close timer on parent re-renders.
  const onClosedRef = useRef(onClosed);
  useEffect(() => {
    onClosedRef.current = onClosed;
  }, [onClosed]);

  // Parent-driven close: slide under the viewport, then hand back control so
  // the parent unmounts the sheet only after the slide has played. If the
  // parent cancels (closing back to false while still mounted), slide back up
  // to the resting offset.
  useEffect(() => {
    if (!closing) {
      if (isDraggingRef.current) return;
      setIsClosing(false);
      currentOffsetRef.current = initialOffset;
      setTranslateY(initialOffset);
      return;
    }
    setIsClosing(true);
    currentOffsetRef.current = window.innerHeight;
    setTranslateY(window.innerHeight);
    // Matches the .draggableSheet.isClosing transition: unmount only after
    // the unhurried slide has fully played.
    const timer = window.setTimeout(() => onClosedRef.current?.(), 520);
    return () => window.clearTimeout(timer);
  }, [closing, initialOffset]);

  // Let the parent slide the sheet between resting positions (e.g. peek vs full
  // height while the docked composer is open). The transform transition animates
  // the change. Ignore while the user is actively dragging.
  useEffect(() => {
    if (isDraggingRef.current || isClosing) return;
    currentOffsetRef.current = initialOffset;
    setTranslateY(initialOffset);
  }, [initialOffset, isClosing]);

  useEffect(() => {
    if (!isMounted) return;

    lockPagePullToRefresh();

    let lastTouchY = 0;

    function handleTouchStart(event: TouchEvent) {
      if (event.touches.length !== 1) return;
      lastTouchY = event.touches[0]?.clientY ?? 0;
    }

    function handleTouchMove(event: TouchEvent) {
      if (event.touches.length !== 1) return;

      const touch = event.touches[0];
      const target = event.target;
      if (!touch || !(target instanceof HTMLElement)) return;

      const currentTouchY = touch.clientY;
      const deltaY = currentTouchY - lastTouchY;
      lastTouchY = currentTouchY;

      const sheet = target.closest(".draggableSheet");
      if (!(sheet instanceof HTMLElement)) {
        event.preventDefault();
        return;
      }

      const scrollContainer = findScrollableAncestor(target, sheet);
      if (!scrollContainer) {
        event.preventDefault();
        return;
      }

      const isPullingDownAtTop = deltaY > 0 && scrollContainer.scrollTop <= 0;
      const isPushingUpAtBottom =
        deltaY < 0 &&
        scrollContainer.scrollTop + scrollContainer.clientHeight >=
          scrollContainer.scrollHeight - 1;

      if (isPullingDownAtTop || isPushingUpAtBottom) {
        event.preventDefault();
      }
    }

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      unlockPagePullToRefresh();
    };
  }, [isMounted]);

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (isClosing || !sheetRef.current) return;
    if (shouldIgnoreSheetDrag(event.target)) return;

    dragStartXRef.current = event.clientX;
    dragStartYRef.current = event.clientY;
    dragStartOffsetRef.current = currentOffsetRef.current;
    isTrackingPointerRef.current = true;
    isDraggingRef.current = false;
    didDragRef.current = false;
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    if (!isTrackingPointerRef.current) return;

    const deltaX = event.clientX - dragStartXRef.current;
    const deltaY = event.clientY - dragStartYRef.current;
    const absDeltaY = Math.abs(deltaY);
    const viewportHeight = window.innerHeight;

    if (!isDraggingRef.current) {
      if (absDeltaY < DRAG_START_THRESHOLD || absDeltaY <= Math.abs(deltaX)) {
        return;
      }

      isDraggingRef.current = true;
      didDragRef.current = true;
      setIsDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    event.preventDefault();

    const nextOffset = Math.min(
      viewportHeight,
      Math.max(0, dragStartOffsetRef.current + deltaY),
    );

    currentOffsetRef.current = nextOffset;
    setTranslateY(nextOffset);
    setDragFadeProgress(getDismissFadeProgress(nextOffset, viewportHeight));
  }

  // How far past the release-would-dismiss threshold this offset is (0..1).
  // MUST mirror the release check in handlePointerUp: fading is a promise that
  // letting go here closes the sheet, so the two use the same numbers.
  function getDismissFadeProgress(offset: number, viewportHeight: number): number {
    const thresholdOffset = Math.min(
      dragStartOffsetRef.current + DISMISS_DRAG_DISTANCE,
      viewportHeight * DISMISS_POSITION_RATIO,
    );
    if (offset <= thresholdOffset) return 0;
    const range = Math.max(1, viewportHeight - thresholdOffset);
    return Math.min(1, (offset - thresholdOffset) / range);
  }

  function requestDismiss(): boolean {
    return onDismiss() !== false;
  }

  function resetSheetPosition() {
    currentOffsetRef.current = initialOffset;
    setTranslateY(initialOffset);
    setDragFadeProgress(0);
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    if (!isTrackingPointerRef.current) return;

    isTrackingPointerRef.current = false;

    if (!isDraggingRef.current) {
      return;
    }

    isDraggingRef.current = false;

    setIsDragging(false);
    window.setTimeout(() => {
      didDragRef.current = false;
    }, 120);

    const viewportHeight = window.innerHeight;
    const dragDistance = currentOffsetRef.current - dragStartOffsetRef.current;

    if (
      dragDistance > DISMISS_DRAG_DISTANCE ||
      currentOffsetRef.current > viewportHeight * DISMISS_POSITION_RATIO
    ) {
      if (!requestDismiss()) {
        resetSheetPosition();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        return;
      }

      setIsClosing(true);
      currentOffsetRef.current = viewportHeight;
      setTranslateY(viewportHeight);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }

    // Released below the threshold: snap back and restore full opacity.
    setDragFadeProgress(0);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  if (!isMounted) return null;

  return createPortal(
    <div
      className={[
        "sheetLayer",
        layerClassName,
        isClosing ? "isClosing" : null,
      ]
        .filter(Boolean)
        .join(" ")}
      role="presentation"
      style={{
        // The dim lifts in step with the held-drag fade; the closing slide
        // handles its own fade via .sheetLayer.isClosing.
        background:
          !isClosing && dragFadeProgress > 0
            ? `rgb(15 23 42 / ${(BACKDROP_ALPHA_PERCENT * (1 - dragFadeProgress)).toFixed(1)}%)`
            : undefined,
        transition: isDragging ? "none" : undefined,
      }}
    >
      {dismissOnBackdrop ? (
        <button
          className="sheetBackdrop"
          type="button"
          aria-label="Close"
          onClick={() => {
            requestDismiss();
          }}
        />
      ) : null}
      <section
        ref={sheetRef}
        className={`draggableSheet ${className ?? ""}${isClosing ? " isClosing" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClickCapture={(event) => {
          if (!didDragRef.current) return;
          event.preventDefault();
          event.stopPropagation();
          didDragRef.current = false;
        }}
        style={{
          "--sheet-rest-offset": `${initialOffset}px`,
          transform: translateY > 0 ? `translateY(${translateY}px)` : undefined,
          // Past the dismiss threshold, dissolve with depth (down to the held
          // floor). The closing slide's fade-to-0 lives in CSS (.isClosing),
          // which the inline value must not override.
          opacity:
            !isClosing && dragFadeProgress > 0
              ? 1 - (1 - HELD_MIN_OPACITY) * dragFadeProgress
              : undefined,
          transition: isDragging ? "none" : undefined,
        } as CSSProperties}
      >
        {showHandle ? (
          <div className="sheetDragZone">
            <div className="quickAddHandle" aria-hidden="true" />
          </div>
        ) : null}
        {children}
      </section>
    </div>,
    document.body,
  );
}

function shouldIgnoreSheetDrag(target: EventTarget): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return Boolean(
    target.closest(
      "input,select,a,[contenteditable='true'],.react-flow,.sortableSubtaskItem,.composeGhostRow",
    ),
  );
}

const DRAG_START_THRESHOLD = 10;

// Release-dismiss thresholds, shared by the release check and the held-drag
// fade so the dimming never promises a close that wouldn't happen.
const DISMISS_DRAG_DISTANCE = 170;
const DISMISS_POSITION_RATIO = 0.42;
// While still held, the sheet dims towards this floor — never fully invisible
// under the finger. The final fade to 0 happens in the closing slide.
const HELD_MIN_OPACITY = 0.25;
// The backdrop dim at rest, in percent (mirrors .sheetLayer's background).
const BACKDROP_ALPHA_PERCENT = 18;

let activeSheetLockCount = 0;

function lockPagePullToRefresh() {
  activeSheetLockCount += 1;
  document.documentElement.classList.add("isBottomSheetOpen");
  document.body.classList.add("isBottomSheetOpen");
}

function unlockPagePullToRefresh() {
  activeSheetLockCount = Math.max(0, activeSheetLockCount - 1);
  if (activeSheetLockCount > 0) return;

  document.documentElement.classList.remove("isBottomSheetOpen");
  document.body.classList.remove("isBottomSheetOpen");
}

function findScrollableAncestor(
  target: HTMLElement,
  boundary: HTMLElement,
): HTMLElement | null {
  let element: HTMLElement | null = target;

  while (element && boundary.contains(element)) {
    if (canScrollVertically(element)) return element;
    if (element === boundary) break;
    element = element.parentElement;
  }

  return canScrollVertically(boundary) ? boundary : null;
}

function canScrollVertically(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;

  return (
    (overflowY === "auto" || overflowY === "scroll") &&
    element.scrollHeight > element.clientHeight
  );
}
