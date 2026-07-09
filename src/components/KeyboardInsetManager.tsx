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

        // Publish the visible (visual viewport) region so fixed overlays such as
        // bottom sheets can be pinned exactly to the area above the keyboard on
        // both iOS Safari and Android Chrome, regardless of how each browser
        // resizes its viewport.
        const viewHeight = viewport
          ? Math.round(viewport.height)
          : window.innerHeight;
        const viewTop = viewport ? Math.round(viewport.offsetTop) : 0;

        const root = document.documentElement.style;
        root.setProperty("--keyboard-inset", `${keyboardInset}px`);
        root.setProperty("--kb-view-height", `${viewHeight}px`);
        root.setProperty("--kb-view-top", `${viewTop}px`);
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
      document.documentElement.style.removeProperty("--kb-view-height");
      document.documentElement.style.removeProperty("--kb-view-top");
    };
  }, []);

  return null;
}
