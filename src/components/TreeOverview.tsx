"use client";

import type { TaskId, TaskNode } from "@/types/task";
import { getPriorityClass } from "@/lib/priority";
import { EditableTitle } from "./EditableTitle";
import { ProgressBar } from "./ProgressBar";
import { ProgressCheckbox } from "./ProgressCheckbox";

type TreeOverviewProps = {
  roots: TaskNode[];
  onOpenMindMap: (taskId: TaskId) => void;
  onSelectTask: (taskId: TaskId) => void;
  onToggleComplete: (taskId: TaskId) => void;
  onRenameTask: (taskId: TaskId, title: string) => void;
};

export function TreeOverview({
  roots,
  onOpenMindMap,
  onSelectTask,
  onToggleComplete,
  onRenameTask,
}: TreeOverviewProps) {
  return (
    <div className="treeCardGrid">
      {roots.map((root) => (
        <article className="treeCard" key={root.id}>
          <div className={root.children.length > 0 ? "treeCardHeader hasProgress" : "treeCardHeader"}>
            {root.children.length > 0 ? (
              <ProgressCheckbox
                checked={root.completed}
                progress={root.progress}
                priority={root.priority}
                onChange={() => onToggleComplete(root.id)}
                ariaLabel={`${root.title} complete`}
              />
            ) : (
              <input
                className={`check ${getPriorityClass(root.priority)}`}
                type="checkbox"
                checked={root.completed}
                onChange={() => onToggleComplete(root.id)}
                aria-label={`${root.title} complete`}
              />
            )}
            <EditableTitle
              value={root.title}
              className={root.completed ? "cardTitle isCompleted" : "cardTitle"}
              inputClassName="cardTitle titleInput"
              onSave={(title) => onRenameTask(root.id, title)}
            />
            {root.children.length > 0 ? <ProgressBar value={root.progress} /> : null}
          </div>
          <button
            className="treeCardPreviewButton"
            type="button"
            onClick={() => onOpenMindMap(root.id)}
            aria-label={`${root.title} tree preview`}
          >
            <MiniFlowPreview root={root} />
          </button>
        </article>
      ))}
    </div>
  );
}

function MiniFlowPreview({ root }: { root: TaskNode }) {
  const nodes = collectPreviewNodes(root).slice(0, 10);

  return (
    <div className="miniFlowPreview">
      {nodes.map((node) => (
        <span
          className={[
            "miniFlowNode",
            node.completed ? "isCompleted" : "",
            node.depth === 0 ? "isRoot" : "",
          ].filter(Boolean).join(" ")}
          style={{
            left: `${node.depth * 30 + 10}%`,
            top: `${node.row * 18 + 14}%`,
          }}
          key={node.id}
          aria-hidden="true"
        />
      ))}
      {nodes.slice(1).map((node) => (
        <span
          className="miniFlowEdge"
          style={{
            left: `${Math.max(8, node.depth * 30 - 2)}%`,
            top: `${node.row * 18 + 17}%`,
            width: "24%",
          }}
          key={`${node.id}-edge`}
          aria-hidden="true"
        />
      ))}
      {countNodes(root) > nodes.length ? (
        <span className="miniFlowMore" aria-hidden="true">
          +{countNodes(root) - nodes.length}
        </span>
      ) : null}
    </div>
  );
}

function collectPreviewNodes(
  node: TaskNode,
  depth = 0,
  rowRef = { value: 0 },
): Array<{ id: TaskId; depth: number; row: number; completed: boolean }> {
  const row = rowRef.value;
  rowRef.value += 1;

  const nodes = [{ id: node.id, depth, row, completed: node.completed }];

  for (const child of node.children) {
    nodes.push(...collectPreviewNodes(child, depth + 1, rowRef));
  }

  return nodes;
}

function countNodes(node: TaskNode): number {
  return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
}
