"use client";

import type { TaskId, TaskNode } from "@/types/task";
import { getPriorityClass } from "@/lib/priority";
import { AddTaskForm } from "./AddTaskForm";
import { ProgressBar } from "./ProgressBar";
import { ProgressCheckbox } from "./ProgressCheckbox";

type TreeFocusViewProps = {
  root: TaskNode;
  addingParentId: TaskId | null;
  onBack: () => void;
  onToggleComplete: (taskId: TaskId) => void;
  onStartAddChild: (taskId: TaskId) => void;
  onAddChild: (parentId: TaskId, title: string) => void;
};

export function TreeFocusView({
  root,
  addingParentId,
  onBack,
  onToggleComplete,
  onStartAddChild,
  onAddChild,
}: TreeFocusViewProps) {
  return (
    <section className="treeFocus">
      <div className="focusToolbar">
        <button className="backButton" type="button" onClick={onBack}>
          {"< Back"}
        </button>
        <div className={root.children.length > 0 ? "focusTitle hasProgress" : "focusTitle"}>
          <h2>{root.title}</h2>
          {root.children.length > 0 ? <ProgressBar value={root.progress} /> : null}
        </div>
      </div>

      <AddTaskForm
        className="focusAdd"
        placeholder={TEXT.addSubtask}
        onAdd={(title) => onAddChild(root.id, title)}
      />

      <div className="focusTree">
        <TreeFocusNode
          node={root}
          addingParentId={addingParentId}
          onToggleComplete={onToggleComplete}
          onStartAddChild={onStartAddChild}
          onAddChild={onAddChild}
        />
      </div>
    </section>
  );
}

function TreeFocusNode({
  node,
  addingParentId,
  onToggleComplete,
  onStartAddChild,
  onAddChild,
}: Omit<TreeFocusViewProps, "root" | "onBack"> & { node: TaskNode }) {
  return (
    <div className="focusNode">
      <div className={node.children.length > 0 ? "focusNodeCard hasProgress" : "focusNodeCard"}>
        <div className="focusNodeMain">
          {node.children.length > 0 ? (
            <ProgressCheckbox
              checked={node.completed}
              progress={node.progress}
              priority={node.priority}
              onChange={() => onToggleComplete(node.id)}
              ariaLabel={`${node.title} complete`}
            />
          ) : (
            <input
              className={`check ${getPriorityClass(node.priority)}`}
              type="checkbox"
              checked={node.completed}
              onChange={() => onToggleComplete(node.id)}
              aria-label={`${node.title} complete`}
            />
          )}
          <span className={node.completed ? "focusNodeTitle isCompleted" : "focusNodeTitle"}>
            {node.title}
          </span>
          <button
            className="iconButton addChild"
            type="button"
            aria-label="Add subtask"
            title="Add subtask"
            onClick={() => onStartAddChild(node.id)}
          >
            +
          </button>
        </div>
        {node.children.length > 0 ? <ProgressBar value={node.progress} /> : null}
      </div>

      {addingParentId === node.id ? (
        <AddTaskForm
          className="focusInlineAdd"
          placeholder={TEXT.addSubtask}
          onAdd={(title) => onAddChild(node.id, title)}
        />
      ) : null}

      {node.children.length > 0 ? (
        <div className="focusChildren">
          {node.children.map((child) => (
            <TreeFocusNode
              key={child.id}
              node={child}
              addingParentId={addingParentId}
              onToggleComplete={onToggleComplete}
              onStartAddChild={onStartAddChild}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

const TEXT = {
  addSubtask: "Add subtask",
};
