import type { AppMessages } from "@/i18n/messages";
import type { PriorityLabels } from "@/lib/priority";

export function getTranslatedPriorityLabels(messages: AppMessages): PriorityLabels {
  return {
    high: messages.priority.high,
    medium: messages.priority.medium,
    low: messages.priority.low,
    none: messages.priority.none,
  };
}
