"use client";

import { Check, ChevronLeft, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { getPriorityClass, getPriorityLabel, PRIORITY_OPTIONS } from "@/lib/priority";
import { usePriorityLabels } from "@/hooks/usePriorityLabels";
import type { TaskPriority } from "@/types/task";
import { DraggableBottomSheet } from "./DraggableBottomSheet";

type PriorityEditorSheetProps = {
  value: TaskPriority;
  onChange: (priority: TaskPriority) => void;
  onDismiss: () => void;
};

export function PriorityEditorSheet({
  value,
  onChange,
  onDismiss,
}: PriorityEditorSheetProps) {
  const [isEditing, setIsEditing] = useState(false);
  const { labels, saveLabels } = usePriorityLabels();
  const [draftLabels, setDraftLabels] = useState(labels);

  useEffect(() => {
    setDraftLabels(labels);
  }, [labels]);

  const hasUnsavedChanges = PRIORITY_OPTIONS.some(
    (option) => draftLabels[option.id] !== labels[option.id],
  );

  function handleDismiss() {
    if (isEditing && hasUnsavedChanges && !window.confirm("Discard unsaved priority changes?")) {
      return;
    }

    onDismiss();
  }

  function handleBackToOptions() {
    if (hasUnsavedChanges && !window.confirm("Discard unsaved priority changes?")) {
      return;
    }

    setDraftLabels(labels);
    setIsEditing(false);
  }

  return (
    <DraggableBottomSheet
      ariaLabel="Edit priority"
      className="prioritySheet"
      dismissOnBackdrop
      onDismiss={handleDismiss}
    >
      {isEditing ? (
        <>
          <button className="priorityBackButton" type="button" onClick={handleBackToOptions}>
            <ChevronLeft size={16} aria-hidden="true" />
            Priority
          </button>
          <div className="priorityEditList">
            {PRIORITY_OPTIONS.map((option) => (
              <label className="priorityEditRow" key={option.id}>
                <span
                  className={`priorityDot ${getPriorityClass(option.id)}`}
                  aria-hidden="true"
                />
                <input
                  value={draftLabels[option.id]}
                  aria-label={`${getPriorityLabel(option.id, labels)} label`}
                  onChange={(event) =>
                    setDraftLabels((currentLabels) => ({
                      ...currentLabels,
                      [option.id]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
          <button
            className="priorityEditSaveButton"
            type="button"
            onClick={() => {
              saveLabels(draftLabels);
              setIsEditing(false);
            }}
          >
            Save
          </button>
        </>
      ) : (
        <>
          <div className="prioritySheetTitle">Priority</div>
          <div className="priorityOptions">
            {PRIORITY_OPTIONS.map((option) => (
              <button
                className={value === option.id ? "priorityOption isSelected" : "priorityOption"}
                type="button"
                key={option.id}
                onClick={() => {
                  onChange(option.id);
                  onDismiss();
                }}
              >
                <span
                  className={`priorityDot ${getPriorityClass(option.id)}`}
                  aria-hidden="true"
                />
                <span>{getPriorityLabel(option.id, labels)}</span>
                {value === option.id ? <Check size={16} aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
          <button className="priorityEditButton" type="button" onClick={() => setIsEditing(true)}>
            <Pencil size={15} aria-hidden="true" />
            Edit priority
          </button>
        </>
      )}
    </DraggableBottomSheet>
  );
}
