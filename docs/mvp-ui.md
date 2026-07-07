# MVP UI

## View Modes

- `List`: simple root task entry and selection view.
- `Task detail`: title, placeholder description, placeholder calendar, and subtasks.
- `Tree`: connected node view for seeing task structure.

## Progress

- Progress is shown inline with the checkbox and title.
- Only the progress bar uses status color.
- Leaf nodes are `0%` or `100%` based on their own checkbox.
- Parent nodes calculate progress from child node progress.
- Checking a parent task does not change child task completion.
- Completing all child tasks automatically completes the parent task.

## Copy

- Root-level input: "Add task" in implementation copy, rendered as Japanese text.
- Child input: "Add subtask" in implementation copy, rendered as Japanese text.
