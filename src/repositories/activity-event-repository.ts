import type { ActivityEvent } from "@/types/activity";
import type { UserId } from "@/types/task";

export type ActivityEventRepository = {
  listEvents(userId: UserId): Promise<ActivityEvent[]>;
  addEvent(event: ActivityEvent): Promise<void>;
  saveEvents(userId: UserId, events: ActivityEvent[]): Promise<void>;
};
