"use client";

import { useRef } from "react";
import type { TouchEvent as ReactTouchEvent, WheelEvent as ReactWheelEvent } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";

type InboxComposeScrimProps = {
  // Forward a vertical scroll delta (px) to the inbox scroller.
  onScrollBy: (delta: number) => void;
  // A tap (not a drag) finishes composing.
  onDismiss: () => void;
};

const TAP_TOLERANCE_PX = 8;

// A transparent full-screen scrim shown while composing an inbox task. It blocks
// taps from reaching the app chrome (group bar/switch, header account UI, tabs)
// — "look but don't touch" — while still letting the list scroll: vertical pans
// and wheel are forwarded to the inbox scroller, mirroring the subtask composer.
// The slim compose bar sits above this (higher z-index) and stays interactive.
export function InboxComposeScrim({ onScrollBy, onDismiss }: InboxComposeScrimProps) {
  const { messages: text } = useLanguage();
  const lastTouchYRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const didDragRef = useRef(false);

  function handleTouchStart(event: ReactTouchEvent<HTMLButtonElement>) {
    const touch = event.touches[0];
    if (!touch) return;
    lastTouchYRef.current = touch.clientY;
    touchStartYRef.current = touch.clientY;
    didDragRef.current = false;
  }

  function handleTouchMove(event: ReactTouchEvent<HTMLButtonElement>) {
    const touch = event.touches[0];
    if (!touch || lastTouchYRef.current === null) return;

    const delta = lastTouchYRef.current - touch.clientY;
    lastTouchYRef.current = touch.clientY;

    if (
      touchStartYRef.current !== null &&
      Math.abs(touch.clientY - touchStartYRef.current) > TAP_TOLERANCE_PX
    ) {
      didDragRef.current = true;
    }

    onScrollBy(delta);
  }

  function handleWheel(event: ReactWheelEvent<HTMLButtonElement>) {
    onScrollBy(event.deltaY);
  }

  function handleClick() {
    // A swipe that scrolled the list must not also finish composing.
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    onDismiss();
  }

  return (
    <button
      className="inboxComposeScrim"
      type="button"
      aria-label={text.common.close}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onWheel={handleWheel}
    />
  );
}
