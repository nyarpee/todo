"use client";

import { useEffect, useState } from "react";
import { DEFAULT_PRIORITY_LABELS, type PriorityLabels } from "@/lib/priority";
import {
  loadPriorityLabels,
  PRIORITY_LABELS_EVENT,
  savePriorityLabels,
} from "@/lib/priority-labels";

export function usePriorityLabels(defaultLabels: PriorityLabels = DEFAULT_PRIORITY_LABELS) {
  const [labels, setLabels] = useState<PriorityLabels>(defaultLabels);

  useEffect(() => {
    function handleLabelsChange() {
      const nextLabels = loadPriorityLabels(defaultLabels);
      // Callers may derive their translated defaults during render, producing a
      // fresh object every time. Do not turn that new reference into a state
      // update unless one of the actual label values changed.
      setLabels((currentLabels) =>
        arePriorityLabelsEqual(currentLabels, nextLabels) ? currentLabels : nextLabels,
      );
    }

    handleLabelsChange();
    window.addEventListener(PRIORITY_LABELS_EVENT, handleLabelsChange);
    return () => window.removeEventListener(PRIORITY_LABELS_EVENT, handleLabelsChange);
  }, [
    defaultLabels.high,
    defaultLabels.medium,
    defaultLabels.low,
    defaultLabels.none,
  ]);

  function saveLabels(nextLabels: PriorityLabels) {
    savePriorityLabels(nextLabels);
    setLabels(nextLabels);
  }

  return { labels, saveLabels };
}

function arePriorityLabelsEqual(first: PriorityLabels, second: PriorityLabels): boolean {
  return (
    first.high === second.high &&
    first.medium === second.medium &&
    first.low === second.low &&
    first.none === second.none
  );
}
