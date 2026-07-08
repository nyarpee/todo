import type { ActivityEvent } from "@/types/activity";
import type { UserId } from "@/types/task";
import type { ActivityEventRepository } from "./activity-event-repository";
import { INDEXED_DB_STORES, listUserRecords, putRecord, replaceUserRecords } from "./indexed-db";

export class IndexedDbActivityEventRepository implements ActivityEventRepository {
  async listEvents(userId: UserId): Promise<ActivityEvent[]> {
    const events = await listUserRecords<ActivityEvent>(INDEXED_DB_STORES.activityEvents, userId);
    const retainedEvents = pruneOldActivityEvents(events);

    if (retainedEvents.length !== events.length) {
      await this.saveEvents(userId, retainedEvents);
    }

    return retainedEvents.sort((first, second) => first.createdAt.localeCompare(second.createdAt));
  }

  async addEvent(event: ActivityEvent): Promise<void> {
    if (isOldActivityEvent(event)) return;

    await putRecord(INDEXED_DB_STORES.activityEvents, event);
  }

  async saveEvents(userId: UserId, events: ActivityEvent[]): Promise<void> {
    await replaceUserRecords(INDEXED_DB_STORES.activityEvents, userId, pruneOldActivityEvents(events));
  }
}

function pruneOldActivityEvents(events: ActivityEvent[]): ActivityEvent[] {
  const cutoff = getActivityEventRetentionCutoff();
  return events.filter((event) => event.createdAt >= cutoff);
}

function isOldActivityEvent(event: ActivityEvent): boolean {
  return event.createdAt < getActivityEventRetentionCutoff();
}

function getActivityEventRetentionCutoff(): string {
  return new Date(Date.now() - ACTIVITY_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

const ACTIVITY_EVENT_RETENTION_DAYS = 30;
