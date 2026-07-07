"use client";

import {
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
  children: ReactNode;
  dismissOnBackdrop?: boolean;
  initialOffset?: number;
  showHandle?: boolean;
  onDismiss: () => boolean | void;
};

export function DraggableBottomSheet({
  ariaLabel,
  className,
  children,
  dismissOnBackdrop = false,
  initialOffset = 0,
  showHandle = true,
  onDismiss,
}: DraggableBottomSheetProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [translateY, setTranslateY] = useState(initialOffset);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
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
  }

  function requestDismiss(): boolean {
    return onDismiss() !== false;
  }

  function resetSheetPosition() {
    currentOffsetRef.current = initialOffset;
    setTranslateY(initialOffset);
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

    if (dragDistance > 170 || currentOffsetRef.current > viewportHeight * 0.42) {
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

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  if (!isMounted) return null;

  return createPortal(
    <div className="sheetLayer" role="presentation">
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
        className={`draggableSheet ${className ?? ""}`}
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
          transform: translateY > 0 ? `translateY(${translateY}px)` : undefined,
          transition: isDragging ? "none" : undefined,
        }}
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
      "input,select,a,[contenteditable='true'],.react-flow",
    ),
  );
}

const DRAG_START_THRESHOLD = 10;
