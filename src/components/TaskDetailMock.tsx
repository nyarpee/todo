"use client";

import Link from "next/link";
import { CalendarDays, Flag, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProgressBar } from "./ProgressBar";

type MockSubtask = {
  id: number;
  title: string;
  completed: boolean;
};

const INITIAL_SUBTASKS: MockSubtask[] = [
  { id: 1, title: "Read the useState documentation", completed: true },
  { id: 2, title: "Build a small counter", completed: false },
  { id: 3, title: "Write down what changed", completed: false },
];

const DESCRIPTION =
  "Learn how state changes affect a component, then build a small example. Keep a note of the parts that still feel unclear so the next study session has an easy starting point.";

export function TaskDetailMock() {
  const [title, setTitle] = useState("Study React");
  const [description, setDescription] = useState(DESCRIPTION);
  const [subtasks, setSubtasks] = useState(INITIAL_SUBTASKS);
  const [draftTitle, setDraftTitle] = useState("");
  const [dueLabel, setDueLabel] = useState("Today, 7:00 PM");
  const [priority, setPriority] = useState<"High" | "Medium" | "Low">("High");
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);

  const completedCount = useMemo(
    () => subtasks.filter((subtask) => subtask.completed).length,
    [subtasks],
  );
  const progress = Math.round((completedCount / subtasks.length) * 100);

  useEffect(() => {
    const input = noteInputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight}px`;
  }, [description]);

  function toggleSubtask(id: number) {
    setSubtasks((current) =>
      current.map((subtask) =>
        subtask.id === id ? { ...subtask, completed: !subtask.completed } : subtask,
      ),
    );
  }

  function addSubtask() {
    const trimmedTitle = draftTitle.trim();
    if (!trimmedTitle) return;

    setSubtasks((current) => [
      ...current,
      { id: Date.now(), title: trimmedTitle, completed: false },
    ]);
    setDraftTitle("");
  }

  function cycleDueDate() {
    setDueLabel((current) =>
      current === "Today, 7:00 PM" ? "Tomorrow" : current === "Tomorrow" ? "No date" : "Today, 7:00 PM",
    );
  }

  function cyclePriority() {
    setPriority((current) =>
      current === "High" ? "Medium" : current === "Medium" ? "Low" : "High",
    );
  }

  return (
    <main className="detailMockPage">
      <div className="detailMockShell">
        <header className="detailMockTopbar">
          <Link className="detailMockBack" href="/">
            Inbox
          </Link>
          <span>Detail mock</span>
        </header>

        <article className="detailMockPaper">
          <header className="detailMockHeader">
            <button
              className="detailMockCheck"
              type="button"
              aria-pressed={progress === 100}
              aria-label="Mark Study React as complete"
              onClick={() =>
                setSubtasks((current) =>
                  current.map((subtask) => ({ ...subtask, completed: progress !== 100 })),
                )
              }
            />
            <input
              className="detailMockTitle"
              aria-label="Task title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <ProgressBar value={progress} />
          </header>

          <div className="detailMockMeta" aria-label="Task settings">
            <button className="detailMockMetaButton" type="button" onClick={cycleDueDate}>
              <CalendarDays size={16} aria-hidden="true" />
              <span>{dueLabel}</span>
            </button>
            <button
              className={`detailMockMetaButton isPriority priority-${priority.toLowerCase()}`}
              type="button"
              onClick={cyclePriority}
            >
              <Flag size={16} aria-hidden="true" />
              <span>{priority}</span>
            </button>
          </div>

          <section className="detailMockSubtasks" aria-labelledby="mock-subtasks-title">
            <div className="detailMockSectionHeading">
              <h2 id="mock-subtasks-title">Subtasks</h2>
              <span>{subtasks.length}</span>
            </div>

            <div className="detailMockSubtaskList">
              {subtasks.map((subtask) => (
                <label
                  className={subtask.completed ? "detailMockSubtask isCompleted" : "detailMockSubtask"}
                  key={subtask.id}
                >
                  <input
                    checked={subtask.completed}
                    type="checkbox"
                    onChange={() => toggleSubtask(subtask.id)}
                  />
                  <span>{subtask.title}</span>
                </label>
              ))}
            </div>

            <form
              className="detailMockAddSubtask"
              onSubmit={(event) => {
                event.preventDefault();
                addSubtask();
              }}
            >
              <Plus size={18} aria-hidden="true" />
              <input
                value={draftTitle}
                placeholder="Add subtask"
                aria-label="Add subtask"
                onChange={(event) => setDraftTitle(event.target.value)}
              />
            </form>
          </section>

          <section className="detailMockNote" aria-label="Task note">
            <textarea
              ref={noteInputRef}
              value={description}
              aria-label="Task note"
              placeholder="Add a note..."
              rows={1}
              onChange={(event) => setDescription(event.target.value)}
            />
          </section>
        </article>

        <p className="detailMockHint">
          This is a visual prototype. Title, task settings, subtasks, and note text are interactive only on this page.
        </p>
      </div>
    </main>
  );
}
