import type { ActivityEvent } from "./activity";
import type { UserId } from "./task";

export type SyncQueueItemStatus = "pending" | "syncing" | "synced" | "failed";

export type SyncQueueItem = {
  id: string;
  userId: UserId;
  activityEventId: string;
  entityType: ActivityEvent["entityType"];
  entityId: ActivityEvent["entityId"];
  operation: ActivityEvent["type"];
  payload: ActivityEvent["payload"];
  clientId: string;
  status: SyncQueueItemStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  syncedAt: string | null;
  lastError: string | null;
};
