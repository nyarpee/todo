"use client";

import type { TaskId, TaskNode } from "@/types/task";
import { AddTaskForm } from "./AddTaskForm";
import { ProgressBar } from "./ProgressBar";

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
        <div className="focusTitle">
          <h2>{root.title}</h2>
          <ProgressBar value={root.progress} />
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
      <div className="focusNodeCard">
        <div className="focusNodeMain">
          <input
            className="check"
            type="checkbox"
            checked={node.completed}
            onChange={() => onToggleComplete(node.id)}
            aria-label={`${node.title} complete`}
          />
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
        <ProgressBar value={node.progress} />
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
  addSubtask: "\u30b5\u30d6\u30bf\u30b9\u30af\u3092\u8ffd\u52a0",
};
