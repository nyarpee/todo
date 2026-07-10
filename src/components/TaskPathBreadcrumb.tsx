"use client";

export type PathCrumb = {
  // `null` for the group/root crumb (label only, never navigable).
  id: string | null;
  label: string;
};

type TaskPathBreadcrumbProps = {
  crumbs: PathCrumb[];
  className?: string;
  ariaLabel?: string;
  onNavigate?: (id: string) => void;
  // When false, the last crumb has no trailing ">" — the path stops at the
  // current level (used on the detail page). Defaults to true so the composer
  // keeps its "next level lives here" trailing separator.
  trailingSeparator?: boolean;
};

type DisplayItem = PathCrumb | { ellipsis: true };

// Every crumb is followed by a ">" — including the last one — so the trailing
// separator signals "the next level lives here" (the title on the detail page,
// or the input in the composer). Deep paths collapse the middle to keep the
// root and the last two levels visible at a glance.
const MAX_VISIBLE = 3;

export function TaskPathBreadcrumb({ crumbs, className, ariaLabel, onNavigate, trailingSeparator = true }: TaskPathBreadcrumbProps) {
  if (crumbs.length === 0) return null;

  let items: DisplayItem[];
  if (crumbs.length > MAX_VISIBLE) {
    const first = crumbs[0];
    items = first ? [first, { ellipsis: true }, ...crumbs.slice(-2)] : [...crumbs];
  } else {
    items = [...crumbs];
  }

  return (
    <nav className={className ? `taskPath ${className}` : "taskPath"} aria-label={ariaLabel}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        if ("ellipsis" in item) {
          return (
            <span className="taskPathCrumb isAncestor" key={`ellipsis-${index}`}>
              <span className="taskPathEllipsis">…</span>
              <span className="taskPathSep" aria-hidden="true">&gt;</span>
            </span>
          );
        }

        const canTap = Boolean(onNavigate && item.id);

        return (
          <span
            className={isLast ? "taskPathCrumb isCurrent" : "taskPathCrumb isAncestor"}
            key={item.id ?? `crumb-${index}`}
          >
            {canTap ? (
              <button
                className="taskPathButton"
                type="button"
                onClick={() => {
                  if (item.id) onNavigate?.(item.id);
                }}
              >
                {item.label}
              </button>
            ) : (
              <span className="taskPathLabel">{item.label}</span>
            )}

            {isLast && !trailingSeparator ? null : (
              <span className="taskPathSep" aria-hidden="true">&gt;</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
