import { createDefaultGroups } from "@/lib/task-groups";
import type { TaskGroup, UserId } from "@/types/task";
import { INDEXED_DB_STORES, listUserRecords, replaceUserRecords } from "./indexed-db";
import { LocalStorageGroupRepository } from "./local-storage-group-repository";

export class IndexedDbGroupRepository {
  private readonly fallbackRepository = new LocalStorageGroupRepository();

  async listGroups(userId: UserId): Promise<TaskGroup[]> {
    const groups = await listUserRecords<TaskGroup>(INDEXED_DB_STORES.taskGroups, userId);
    if (groups.length > 0) return groups;

    const migratedGroups = await this.fallbackRepository.listGroups(userId);
    const nextGroups = migratedGroups.length > 0 ? migratedGroups : createDefaultGroups(userId);
    await this.saveGroups(userId, nextGroups);
    return nextGroups;
  }

  async saveGroups(userId: UserId, groups: TaskGroup[]): Promise<void> {
    await replaceUserRecords(INDEXED_DB_STORES.taskGroups, userId, groups);
  }
}
