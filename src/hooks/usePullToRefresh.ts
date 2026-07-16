"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

const RESISTANCE = 0.5; // Dampen the finger travel into a shorter pull.
const MAX_PULL = 96; // Cap so the spinner never wanders too far down.
const TRIGGER_THRESHOLD = 64; // Release past this to fire the refresh.
const ENGAGE_SLOP = 6; // Ignore tiny/ambiguous moves before committing.
// Any sideways travel beyond this before committing means the gesture is a
// horizontal group swipe — never turn it into a pull.
const HORIZONTAL_CANCEL_SLOP = 10;
// A pull must start moving quickly. Drag-to-reorder (dnd-kit) activates only
// after a ~180ms still press-and-hold, so requiring the first real move before
// this limit keeps a reorder drag from being mistaken for a refresh pull.
const ENGAGE_TIME_LIMIT_MS = 160;

type PullToRefreshState = {
  // Current pull distance in px (0 when idle).
  pull: number;
  // True from the moment a refresh fires until the page reloads.
  refreshing: boolean;
};

// Custom pull-to-refresh for the fixed-shell layout. The document itself never
// scrolls (that keeps the bottom sheets from wobbling), which also disables the
// browser's native pull-to-refresh — so we re-add the gesture on the app's own
// scroll container. Native browser behaviour is unchanged elsewhere.
export function usePullToRefresh(
  scrollRef: RefObject<HTMLElement | null>,
  onRefresh: () => void,
): PullToRefreshState {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const distRef = useRef(0);
  const activeRef = useRef(false);
  const busyRef = useRef(false);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    // The nearest vertically scrollable element under the touch, up to (and
    // including) the app scroller. We only engage when that element is at its
    // top, so pulling inside a nested scroller (e.g. the calendar day list)
    // that isn't scrolled to the top keeps scrolling instead of refreshing.
    function scrollerAtPoint(target: EventTarget | null): HTMLElement | null {
      let node = target instanceof HTMLElement ? target : null;
      while (node && container.contains(node)) {
        const overflowY = window.getComputedStyle(node).overflowY;
        if (
          (overflowY === "auto" || overflowY === "scroll") &&
          node.scrollHeight > node.clientHeight
        ) {
          return node;
        }
        if (node === container) break;
        node = node.parentElement;
      }
      return container;
    }

    function reset() {
      startXRef.current = null;
      startYRef.current = null;
      if (activeRef.current || distRef.current !== 0) {
        activeRef.current = false;
        distRef.current = 0;
        setPull(0);
      }
    }

    function handleTouchStart(event: TouchEvent) {
      if (busyRef.current || event.touches.length !== 1) {
        startYRef.current = null;
        return;
      }
      const scroller = scrollerAtPoint(event.target);
      if (!scroller || scroller.scrollTop > 0) {
        startYRef.current = null;
        return;
      }
      const touch = event.touches[0];
      startXRef.current = touch.clientX;
      startYRef.current = touch.clientY;
      startTimeRef.current = event.timeStamp;
      activeRef.current = false;
    }

    function handleTouchMove(event: TouchEvent) {
      if (busyRef.current || startYRef.current === null || startXRef.current === null) {
        return;
      }
      const touch = event.touches[0];
      const dy = touch.clientY - startYRef.current;
      const dx = touch.clientX - startXRef.current;

      if (!activeRef.current) {
        // Too slow to be a pull — treat as a hold/reorder and bow out.
        if (event.timeStamp - startTimeRef.current > ENGAGE_TIME_LIMIT_MS) {
          startYRef.current = null;
          startXRef.current = null;
          return;
        }
        // A clear sideways component means a group swipe: bow out for the rest
        // of this touch so a slightly diagonal swipe can't drop the refresh
        // spinner over the group bar.
        if (Math.abs(dx) > HORIZONTAL_CANCEL_SLOP) {
          startYRef.current = null;
          startXRef.current = null;
          return;
        }
        // Commit to a pull only once the move is clearly a downward drag —
        // dominantly vertical, not merely "more down than across".
        if (dy < ENGAGE_SLOP || dy <= Math.abs(dx) * 2) return;
        const scroller = scrollerAtPoint(event.target);
        if (scroller && scroller.scrollTop > 0) {
          reset();
          return;
        }
        activeRef.current = true;
      }

      if (dy <= 0) {
        reset();
        return;
      }

      // Take over the gesture so the scroller doesn't fight the pull.
      event.preventDefault();
      const next = Math.min(MAX_PULL, dy * RESISTANCE);
      distRef.current = next;
      setPull(next);
    }

    function handleTouchEnd() {
      if (busyRef.current) return;
      if (!activeRef.current) {
        reset();
        return;
      }
      const shouldRefresh = distRef.current >= TRIGGER_THRESHOLD;
      startXRef.current = null;
      startYRef.current = null;
      activeRef.current = false;

      if (shouldRefresh) {
        busyRef.current = true;
        distRef.current = TRIGGER_THRESHOLD;
        setPull(TRIGGER_THRESHOLD);
        setRefreshing(true);
        onRefresh();
        return;
      }
      distRef.current = 0;
      setPull(0);
    }

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });
    container.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [scrollRef, onRefresh]);

  return { pull, refreshing };
}

export { TRIGGER_THRESHOLD as PULL_TRIGGER_THRESHOLD };
