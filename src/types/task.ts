export type TaskId = string;
export type TaskGroupId = string;
export type UserId = string;
export type TaskPriority = "high" | "medium" | "low" | "none";

export type TaskGroup = {
  id: TaskGroupId;
  userId: UserId;
  name: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type Task = {
  id: TaskId;
  userId: UserId;
  title: string;
  description: string;
  groupId: TaskGroupId;
  parentId: TaskId | null;
  order: number;
  completed: boolean;
  completedAt: string | null;
  priority: TaskPriority;
  dueDate: string | null;
  dueTime: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskNode = Task & {
  children: TaskNode[];
  depth: number;
  progress: number;
};

export type CreateTaskInput = {
  userId: UserId;
  title: string;
  description?: string;
  groupId?: TaskGroupId;
  priority?: TaskPriority;
  dueDate?: string | null;
  dueTime?: string | null;
  parentId?: TaskId | null;
};

export type UpdateTaskInput = Partial<
  Pick<
    Task,
    | "title"
    | "description"
    | "groupId"
    | "completed"
    | "completedAt"
    | "parentId"
    | "order"
    | "priority"
    | "dueDate"
    | "dueTime"
  >
>;
