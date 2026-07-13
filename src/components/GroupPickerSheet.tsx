"use client";

import { Check } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageProvider";
import type { TaskGroup, TaskGroupId } from "@/types/task";
import { DraggableBottomSheet } from "./DraggableBottomSheet";

type GroupPickerSheetProps = {
  groups: TaskGroup[];
  value: TaskGroupId;
  // Called when a group is tapped. The parent applies the change and closes.
  onChange: (groupId: TaskGroupId) => void;
  onDismiss: () => void;
};

// Compact list picker for choosing the target group while composing a task.
export function GroupPickerSheet({ groups, value, onChange, onDismiss }: GroupPickerSheetProps) {
  const { messages: text } = useLanguage();

  return (
    <DraggableBottomSheet
      ariaLabel={text.lists.area}
      className="groupPickerSheet"
      dismissOnBackdrop
      onDismiss={onDismiss}
    >
      <div className="groupPickerList">
        {groups.map((group) => {
          const isSelected = group.id === value;
          return (
            <button
              key={group.id}
              type="button"
              className={isSelected ? "groupPickerRow isSelected" : "groupPickerRow"}
              onClick={() => onChange(group.id)}
            >
              <span>{group.name}</span>
              {isSelected ? <Check size={18} aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </DraggableBottomSheet>
  );
}
