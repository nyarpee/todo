"use client";

import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import type { TaskNode } from "@/types/task";
import { ScheduleEditorSheet } from "./ScheduleEditorSheet";

type DatePickerViewProps = {
  task: TaskNode;
  onBack: () => void;
  onSave: (dueDate: string | null, dueTime: string | null, scheduleType: TaskNode["scheduleType"]) => void;
};

export function DatePickerView({ task, onBack, onSave }: DatePickerViewProps) {
  const { messages: text } = useLanguage();
  const initialDueDate = task.dueDate;
  const initialDueTime = task.dueTime;
  const [draftDate, setDraftDate] = useState<string | null>(initialDueDate);
  const [draftTime, setDraftTime] = useState<string | null>(initialDueTime);
  const [draftScheduleType, setDraftScheduleType] = useState(task.scheduleType);
  const hasUnsavedChanges =
    initialDueDate !== draftDate || initialDueTime !== draftTime || task.scheduleType !== draftScheduleType;

  function handleDismiss() {
    if (
      hasUnsavedChanges &&
      !window.confirm(text.taskDetail.discardDateChanges)
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
      scheduleType={draftScheduleType}
      onChange={(nextDueDate, nextDueTime, nextScheduleType) => {
        setDraftDate(nextDueDate);
        setDraftTime(nextDueTime);
        setDraftScheduleType(nextScheduleType);
      }}
      onDismiss={handleDismiss}
      onSave={() => onSave(draftDate, draftTime, draftScheduleType)}
    />
  );
}
