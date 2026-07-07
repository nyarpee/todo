"use client";

export type ViewMode = "list" | "tree";

type ViewToggleProps = {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
};

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="viewToggle" role="group" aria-label="View mode">
      <button
        className={value === "list" ? "toggleButton isActive" : "toggleButton"}
        type="button"
        onClick={() => onChange("list")}
      >
        List
      </button>
      <button
        className={value === "tree" ? "toggleButton isActive" : "toggleButton"}
        type="button"
        onClick={() => onChange("tree")}
      >
        Tree
      </button>
    </div>
  );
}
