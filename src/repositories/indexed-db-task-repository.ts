import type { Task, UserId } from "@/types/task";
import type { TaskRepository } from "./task-repository";
import { INDEXED_DB_STORES, listUserRecords, replaceUserRecords } from "./indexed-db";
import { LocalStorageTaskRepository } from "./local-storage-task-repository";

export class IndexedDbTaskRepository implements TaskRepository {
  private readonly fallbackRepository = new LocalStorageTaskRepository();

  async listTasks(userId: UserId): Promise<Task[]> {
    const tasks = await listUserRecords<Task>(INDEXED_DB_STORES.tasks, userId);
    if (tasks.length > 0) return tasks;

    const migratedTasks = await this.fallbackRepository.listTasks(userId);
    if (migratedTasks.length > 0) {
      await this.saveTasks(userId, migratedTasks);
    }

    return migratedTasks;
  }

  async saveTasks(userId: UserId, tasks: Task[]): Promise<void> {
    await replaceUserRecords(INDEXED_DB_STORES.tasks, userId, tasks);
  }
}
