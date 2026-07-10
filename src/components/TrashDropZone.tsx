"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";

export const TRASH_DROPPABLE_ID = "trash-drop";

type TrashDropZoneProps = {
  // True while a task is being dragged.
  active: boolean;
};

// A droppable that floats up from the bottom while dragging a task; dropping a
// task on (or near) it deletes the task. Rendered via a portal so it sits above
// the list and stays pinned to the viewport bottom. The droppable node is a
// generously sized transparent catch area so the task doesn't have to land
// precisely on the small bin; the visible bin is centred inside it.
export function TrashDropZone({ active }: TrashDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: TRASH_DROPPABLE_ID });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const className = ["trashDropZone", active ? "isVisible" : "", isOver ? "isOver" : ""]
    .filter(Boolean)
    .join(" ");

  return createPortal(
    <div ref={setNodeRef} className={className} aria-hidden={!active}>
      <span className="trashDropZoneIcon">
        <Trash2 size={26} aria-hidden="true" />
      </span>
    </div>,
    document.body,
  );
}
