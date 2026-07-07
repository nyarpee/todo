"use client";

import { useState } from "react";
import type { TaskNode } from "@/types/task";
import { ScheduleEditorSheet } from "./ScheduleEditorSheet";

type DatePickerViewProps = {
  task: TaskNode;
  onBack: () => void;
  onSave: (dueDate: string | null, dueTime: string | null) => void;
};

export function DatePickerView({ task, onBack, onSave }: DatePickerViewProps) {
  const initialDueDate = task.dueDate;
  const initialDueTime = task.dueTime;
  const [draftDate, setDraftDate] = useState<string | null>(initialDueDate);
  const [draftTime, setDraftTime] = useState<string | null>(initialDueTime);
  const hasUnsavedChanges =
    initialDueDate !== draftDate || initialDueTime !== draftTime;

  function handleDismiss() {
    if (
      hasUnsavedChanges &&
      !window.confirm("Discard unsaved date changes?")
    ) {
      return false;
    }

    onBack();
    return true;
  }

  return (
    <ScheduleEditorSheet
      title={task.title}
      dueDate={draftDate}
      dueTime={draftTime}
      onChange={(nextDueDate, nextDueTime) => {
        setDraftDate(nextDueDate);
        setDraftTime(nextDueTime);
      }}
      onDismiss={handleDismiss}
      onSave={() => onSave(draftDate, draftTime)}
    />
  );
}
