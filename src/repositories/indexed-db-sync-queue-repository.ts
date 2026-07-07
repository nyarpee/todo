import type { SyncQueueItem } from "@/types/sync";
import type { UserId } from "@/types/task";
import { INDEXED_DB_STORES, listUserRecords, putRecord } from "./indexed-db";
import type { SyncQueueRepository } from "./sync-queue-repository";

export class IndexedDbSyncQueueRepository implements SyncQueueRepository {
  async listPendingItems(userId: UserId): Promise<SyncQueueItem[]> {
    const items = await listUserRecords<SyncQueueItem>(INDEXED_DB_STORES.syncQueue, userId);

    return items
      .filter((item) => item.status === "pending" || item.status === "failed")
      .sort((first, second) => first.createdAt.localeCompare(second.createdAt));
  }

  async enqueueItem(item: SyncQueueItem): Promise<void> {
    await putRecord(INDEXED_DB_STORES.syncQueue, item);
  }

  async markItemsSynced(userId: UserId, itemIds: string[]): Promise<void> {
    if (itemIds.length === 0) return;

    const syncedAt = new Date().toISOString();
    const ids = new Set(itemIds);
    const items = await listUserRecords<SyncQueueItem>(INDEXED_DB_STORES.syncQueue, userId);
    await Promise.all(
      items
        .filter((item) => ids.has(item.id))
        .map((item) =>
          putRecord(INDEXED_DB_STORES.syncQueue, {
            ...item,
            status: "synced",
            updatedAt: syncedAt,
            syncedAt,
            lastError: null,
          }),
        ),
    );
  }
}
