"use client";

import { getPriorityClass } from "@/lib/priority";
import type { TaskPriority } from "@/types/task";

type ProgressCheckboxProps = {
  checked: boolean;
  progress: number;
  priority: TaskPriority;
  onChange: () => void;
  ariaLabel: string;
  disabled?: boolean;
};

export function ProgressCheckbox({
  checked,
  progress,
  priority,
  onChange,
  ariaLabel,
  disabled = false,
}: ProgressCheckboxProps) {
  const safeProgress = Math.max(0, Math.min(100, progress));

  return (
    <label
      className={`progressCheckbox ${getPriorityClass(priority)}${checked ? " isChecked" : ""}`}
      onClick={(event) => event.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        aria-label={ariaLabel}
      />
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle className="progressCheckboxBase" cx="12" cy="12" r="9" pathLength="100" />
        <circle
          className="progressCheckboxValue"
          cx="12"
          cy="12"
          r="9"
          pathLength="100"
          strokeDasharray={`${safeProgress} 100`}
        />
      </svg>
      <span className="progressCheckboxMark" aria-hidden="true" />
    </label>
  );
}
