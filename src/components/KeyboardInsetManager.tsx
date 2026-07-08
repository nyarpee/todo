"use client";

import { useEffect } from "react";

export function KeyboardInsetManager() {
  useEffect(() => {
    let animationFrameId = 0;

    function updateKeyboardInset() {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(() => {
        const viewport = window.visualViewport;
        const focusedElement = document.activeElement;
        const shouldTrackKeyboard =
          focusedElement instanceof HTMLElement &&
          Boolean(focusedElement.closest("input,textarea,select,[contenteditable='true']"));
        const rawInset = viewport
          ? window.innerHeight - viewport.height - viewport.offsetTop
          : 0;
        const keyboardInset = shouldTrackKeyboard ? Math.max(0, Math.round(rawInset)) : 0;

        document.documentElement.style.setProperty(
          "--keyboard-inset",
          `${keyboardInset}px`,
        );
      });
    }

    updateKeyboardInset();
    window.visualViewport?.addEventListener("resize", updateKeyboardInset);
    window.visualViewport?.addEventListener("scroll", updateKeyboardInset);
    window.addEventListener("resize", updateKeyboardInset);
    window.addEventListener("orientationchange", updateKeyboardInset);
    window.addEventListener("focusin", updateKeyboardInset);
    window.addEventListener("focusout", updateKeyboardInset);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.visualViewport?.removeEventListener("resize", updateKeyboardInset);
      window.visualViewport?.removeEventListener("scroll", updateKeyboardInset);
      window.removeEventListener("resize", updateKeyboardInset);
      window.removeEventListener("orientationchange", updateKeyboardInset);
      window.removeEventListener("focusin", updateKeyboardInset);
      window.removeEventListener("focusout", updateKeyboardInset);
      document.documentElement.style.removeProperty("--keyboard-inset");
    };
  }, []);

  return null;
}
