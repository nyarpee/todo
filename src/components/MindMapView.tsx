"use client";

import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import type { MouseEvent } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import type { AppMessages } from "@/i18n/messages";
import { getPriorityClass } from "@/lib/priority";
import type { TaskId, TaskNode } from "@/types/task";
import { EditableTitle } from "./EditableTitle";
import { ProgressBar } from "./ProgressBar";
import { ProgressCheckbox } from "./ProgressCheckbox";

type MindMapViewProps = {
  root: TaskNode;
  onAddChild: (parentId: TaskId) => void;
  onRenameTask: (taskId: TaskId, title: string) => void;
  onDeleteTask: (taskId: TaskId) => void;
  autoEditTaskId: TaskId | null;
  onAutoEditConsumed: () => void;
  onSelectTask: (taskId: TaskId) => void;
  onToggleComplete: (taskId: TaskId) => void;
};

type TaskMindMapNodeData = {
  task: TaskNode;
  onAddChild: (parentId: TaskId) => void;
  onRenameTask: (taskId: TaskId, title: string) => void;
  onDeleteTask: (task: TaskNode) => void;
  autoEditTaskId: TaskId | null;
  onAutoEditConsumed: () => void;
  onSelectTask: (taskId: TaskId) => void;
  onToggleComplete: (taskId: TaskId) => void;
  text: AppMessages;
};

const nodeTypes = {
  taskMindMapNode: TaskMindMapNode,
};

export function MindMapView({
  root,
  onAddChild,
  onRenameTask,
  onDeleteTask,
  autoEditTaskId,
  onAutoEditConsumed,
  onSelectTask,
  onToggleComplete,
}: MindMapViewProps) {
  const { messages: text } = useLanguage();
  const { nodes, edges } = buildMindMap(root, {
    onAddChild,
    onRenameTask,
    onDeleteTask: (task) => confirmDelete(task, onDeleteTask, text.taskDetail.deleteWithSubtasks),
    autoEditTaskId,
    onAutoEditConsumed,
    onSelectTask,
    onToggleComplete,
    text,
  });

  return (
    <section className="mindMapView">
      <div className="mindMapToolbar">
        <div className={root.children.length > 0 ? "mindMapTitle hasProgress" : "mindMapTitle"}>
          <h2>{root.title}</h2>
          {root.children.length > 0 ? <ProgressBar value={root.progress} /> : null}
        </div>
      </div>

      <div className="mindMapCanvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.3}
          maxZoom={1.6}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          zoomOnScroll
          panOnScroll={false}
        >
          <Background color="var(--canvas-grid)" gap={24} />
          <Controls />
        </ReactFlow>
      </div>
    </section>
  );
}

function TaskMindMapNode({ data }: NodeProps<Node<TaskMindMapNodeData>>) {
  const {
    task,
    onAddChild,
    onRenameTask,
    onDeleteTask,
    autoEditTaskId,
    onAutoEditConsumed,
    onSelectTask,
    onToggleComplete,
    text,
  } = data;

  return (
    <div
      className="mindMapNode"
      onClick={(event) => handleNodeClick(event, task.id, onSelectTask)}
    >
      <Handle className="mindMapHandle" type="target" position={Position.Left} />
      <div className="mindMapNodeMain">
        {task.children.length > 0 ? (
          <ProgressCheckbox
            checked={task.completed}
            progress={task.progress}
            priority={task.priority}
            onChange={() => onToggleComplete(task.id)}
            ariaLabel={text.taskDetail.complete.replace("{title}", task.title)}
          />
        ) : (
          <input
            className={`check ${getPriorityClass(task.priority)}`}
            type="checkbox"
            checked={task.completed}
            onChange={() => onToggleComplete(task.id)}
            aria-label={text.taskDetail.complete.replace("{title}", task.title)}
          />
        )}
        <EditableTitle
          value={task.title}
          className={task.completed ? "mindMapNodeTitle isCompleted" : "mindMapNodeTitle"}
          inputClassName="mindMapNodeTitle mindMapNodeTitleInput"
          taskId={task.id}
          autoEditTaskId={autoEditTaskId}
          onAutoEditConsumed={onAutoEditConsumed}
          onClick={() => onSelectTask(task.id)}
          onSave={(title) => onRenameTask(task.id, title)}
        />
      </div>
      {task.children.length > 0 ? <ProgressBar value={task.progress} /> : null}
      <button
        className="mindMapAddHandle"
        type="button"
        aria-label={text.taskDetail.addChildTask}
        title={text.taskDetail.addChildTask}
        onClick={(event) => {
          event.stopPropagation();
          onAddChild(task.id);
        }}
      >
        +
      </button>
      <button
        className="mindMapDeleteHandle"
        type="button"
        aria-label={text.taskDetail.deleteTask}
        title={text.taskDetail.deleteTask}
        onClick={(event) => {
          event.stopPropagation();
          onDeleteTask(task);
        }}
      >
        x
      </button>
      <Handle className="mindMapHandle" type="source" position={Position.Right} />
    </div>
  );
}

function buildMindMap(
  root: TaskNode,
  handlers: Omit<TaskMindMapNodeData, "task">,
): { nodes: Node<TaskMindMapNodeData>[]; edges: Edge[] } {
  const nodes: Node<TaskMindMapNodeData>[] = [];
  const edges: Edge[] = [];

  layoutNode(root, 0, 0);

  return { nodes, edges };

  function layoutNode(task: TaskNode, depth: number, top: number): number {
    const subtreeHeight = getSubtreeLeafCount(task) * MIND_MAP_ROW_GAP;
    const y = top + subtreeHeight / 2 - MIND_MAP_NODE_HEIGHT / 2;

    nodes.push({
      id: task.id,
      type: "taskMindMapNode",
      position: {
        x: depth * MIND_MAP_COLUMN_GAP,
        y,
      },
      data: {
        task,
        ...handlers,
      },
    });

    let childTop = top;
    task.children.forEach((child) => {
      edges.push({
        id: `${task.id}-${child.id}`,
        source: task.id,
        target: child.id,
        type: "smoothstep",
      });
      childTop = layoutNode(child, depth + 1, childTop);
    });

    return top + subtreeHeight;
  }
}

function getSubtreeLeafCount(task: TaskNode): number {
  if (task.children.length === 0) return 1;
  return task.children.reduce((sum, child) => sum + getSubtreeLeafCount(child), 0);
}

const MIND_MAP_COLUMN_GAP = 330;
const MIND_MAP_ROW_GAP = 116;
const MIND_MAP_NODE_HEIGHT = 82;

function confirmDelete(task: TaskNode, onDeleteTask: (taskId: TaskId) => void, message: string) {
  if (task.children.length === 0) {
    onDeleteTask(task.id);
    return;
  }

  if (window.confirm(message)) {
    onDeleteTask(task.id);
  }
}

function handleNodeClick(
  event: MouseEvent<HTMLDivElement>,
  taskId: TaskId,
  onSelectTask: (taskId: TaskId) => void,
) {
  const target = event.target as HTMLElement;
  if (target.closest("button,input")) return;

  onSelectTask(taskId);
}
