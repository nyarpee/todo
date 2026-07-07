"use client";

import { useEffect, useState } from "react";
import { DEFAULT_PRIORITY_LABELS, type PriorityLabels } from "@/lib/priority";
import {
  loadPriorityLabels,
  PRIORITY_LABELS_EVENT,
  savePriorityLabels,
} from "@/lib/priority-labels";

export function usePriorityLabels() {
  const [labels, setLabels] = useState<PriorityLabels>(DEFAULT_PRIORITY_LABELS);

  useEffect(() => {
    function handleLabelsChange() {
      setLabels(loadPriorityLabels());
    }

    handleLabelsChange();
    window.addEventListener(PRIORITY_LABELS_EVENT, handleLabelsChange);
    return () => window.removeEventListener(PRIORITY_LABELS_EVENT, handleLabelsChange);
  }, []);

  function saveLabels(nextLabels: PriorityLabels) {
    savePriorityLabels(nextLabels);
    setLabels(nextLabels);
  }

  return { labels, saveLabels };
}
