"use client";

import { FormEvent, useState } from "react";

type AddTaskFormProps = {
  placeholder: string;
  className?: string;
  mode?: "form" | "button";
  onAdd: (title: string) => void;
};

export function AddTaskForm({
  placeholder,
  className,
  mode = "form",
  onAdd,
}: AddTaskFormProps) {
  const [title, setTitle] = useState("");

  if (mode === "button") {
    return (
      <button
        className={`quickAddButton ${className ?? ""}`}
        type="button"
        onClick={() => onAdd("")}
        aria-label={placeholder}
      >
        +
      </button>
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) return;

    onAdd(trimmedTitle);
    setTitle("");
  }

  return (
    <form className={`addForm ${className ?? ""}`} onSubmit={handleSubmit}>
      <input
        className="addInput"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <button className="addButton" type="submit" aria-label={placeholder}>
        +
      </button>
    </form>
  );
}
