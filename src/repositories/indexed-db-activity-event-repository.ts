import type { ActivityEvent } from "@/types/activity";
import type { UserId } from "@/types/task";
import type { ActivityEventRepository } from "./activity-event-repository";
import { INDEXED_DB_STORES, listUserRecords, putRecord, replaceUserRecords } from "./indexed-db";

export class IndexedDbActivityEventRepository implements ActivityEventRepository {
  async listEvents(userId: UserId): Promise<ActivityEvent[]> {
    const events = await listUserRecords<ActivityEvent>(INDEXED_DB_STORES.activityEvents, userId);
    return events.sort((first, second) => first.createdAt.localeCompare(second.createdAt));
  }

  async addEvent(event: ActivityEvent): Promise<void> {
    await putRecord(INDEXED_DB_STORES.activityEvents, event);
  }

  async saveEvents(userId: UserId, events: ActivityEvent[]): Promise<void> {
    await replaceUserRecords(INDEXED_DB_STORES.activityEvents, userId, events);
  }
}
