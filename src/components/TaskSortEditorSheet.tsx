"use client";

import { Check } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { getTaskSortLabels } from "@/i18n/task-sort-labels";
import type { TaskSortMode } from "@/lib/task-sort";
import { DraggableBottomSheet } from "./DraggableBottomSheet";

const MODES: TaskSortMode[] = ["manual", "created", "schedule", "importance"];

type TaskSortEditorSheetProps = {
  value: TaskSortMode;
  onChange: (mode: TaskSortMode) => void;
  onDismiss: () => void;
};

export function TaskSortEditorSheet({ value, onChange, onDismiss }: TaskSortEditorSheetProps) {
  const { language } = useLanguage();
  const labels = getTaskSortLabels(language);

  return (
    <DraggableBottomSheet
      ariaLabel={labels.title}
      className="taskSortSheet"
      dismissOnBackdrop
      onDismiss={onDismiss}
    >
      <h2>{labels.title}</h2>
      <div className="taskSortOptions">
        {MODES.map((mode) => (
          <button
            className={mode === value ? "isSelected" : ""}
            key={mode}
            type="button"
            onClick={() => {
              onChange(mode);
              onDismiss();
            }}
          >
            <span>
              <strong>{labels.modes[mode]}</strong>
              <small>{labels.descriptions[mode]}</small>
            </span>
            {mode === value ? <Check size={19} aria-hidden="true" /> : null}
          </button>
        ))}
      </div>
    </DraggableBottomSheet>
  );
}
