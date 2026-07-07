import type { SyncQueueItem } from "@/types/sync";
import type { UserId } from "@/types/task";

export type SyncQueueRepository = {
  listPendingItems(userId: UserId): Promise<SyncQueueItem[]>;
  enqueueItem(item: SyncQueueItem): Promise<void>;
  markItemsSynced(userId: UserId, itemIds: string[]): Promise<void>;
};
