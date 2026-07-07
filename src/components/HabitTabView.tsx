"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MoreVertical } from "lucide-react";
import type { HabitEntryId, HabitId, HabitWithEntries } from "@/types/habit";

type HabitTabViewProps = {
  habits: HabitWithEntries[];
  onCheck: (habitId: HabitId) => void;
  onUncheck: (entryId: HabitEntryId) => void;
  onOpenMenu: (habitId: HabitId) => void;
  onReorder: (activeId: HabitId, overId: HabitId) => void;
};

export function HabitTabView({
  habits,
  onCheck,
  onUncheck,
  onOpenMenu,
  onReorder,
}: HabitTabViewProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 180,
        tolerance: 8,
      },
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;

    if (!overId || activeId === overId) return;
    onReorder(activeId, overId);
  }

  if (habits.length === 0) {
    return (
      <section className="habitTabView">
        <div className="emptyState compactEmpty">
          <p>No habits yet.</p>
        </div>
      </section>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={habits.map((habit) => habit.id)} strategy={verticalListSortingStrategy}>
        <section className="habitTabView">
          {habits.map((habit) => (
            <SortableHabitCard
              habit={habit}
              key={habit.id}
              onCheck={onCheck}
              onOpenMenu={onOpenMenu}
              onUncheck={onUncheck}
            />
          ))}
        </section>
      </SortableContext>
    </DndContext>
  );
}

type HabitCardProps = {
  habit: HabitWithEntries;
  onCheck: (habitId: HabitId) => void;
  onUncheck: (entryId: HabitEntryId) => void;
  onOpenMenu: (habitId: HabitId) => void;
};

function SortableHabitCard(props: HabitCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.habit.id });

  return (
    <div
      ref={setNodeRef}
      className={isDragging ? "habitSortableItem isDragging" : "habitSortableItem"}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
    >
      <HabitCard {...props} />
    </div>
  );
}

function HabitCard({ habit, onCheck, onUncheck, onOpenMenu }: HabitCardProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const entries = habit.entries
    .slice()
    .sort((first, second) => first.createdAt.localeCompare(second.createdAt));
  const visibleBoxCount = Math.max(10, entries.length + 10);
  const boxes = Array.from({ length: visibleBoxCount }, (_, index) => {
    const entry = entries[index] ?? null;
    const isNext = index === entries.length;
    const distanceFromNext = Math.max(0, index - entries.length);
    const opacity = entry ? 1 : Math.max(0.05, 1 - distanceFromNext * 0.105);
    return { entry, index, isNext, opacity };
  });

  useEffect(() => {
    if (!gridRef.current) return;
    gridRef.current.scrollTop = gridRef.current.scrollHeight;
  }, [entries.length]);

  return (
    <article className="habitCard" data-color={habit.color}>
      <header className="habitCardHeader">
        <div className="habitTitleBlock">
          <h2>{habit.title}</h2>
          <span>{formatUnitLabel(habit)}</span>
        </div>
        <strong>{formatHabitTotal(habit)}</strong>
        <button
          className="groupMenuButton"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenMenu(habit.id);
          }}
          aria-label={`${habit.title} menu`}
        >
          <MoreVertical size={18} aria-hidden="true" />
        </button>
      </header>

      <div ref={gridRef} className="habitCheckGrid" aria-label={`${habit.title} checks`}>
        {boxes.map((box) => {
          const className = [
            "habitCheckBox",
            box.entry ? "isChecked" : "",
            box.isNext ? "isNext" : "",
            !box.entry && !box.isNext ? "isLocked" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              className={className}
              style={{ "--box-opacity": box.opacity } as CSSProperties}
              type="button"
              key={box.entry?.id ?? `empty-${box.index}`}
              disabled={!box.entry && !box.isNext}
              onClick={(event) => {
                event.stopPropagation();
                if (box.entry) {
                  onUncheck(box.entry.id);
                  return;
                }
                onCheck(habit.id);
              }}
              aria-label={
                box.entry
                  ? `Remove ${formatHabitUnit(habit, box.entry.minutes)}`
                  : `Add ${formatHabitUnit(habit, habit.unitMinutes)}`
              }
            />
          );
        })}
      </div>
    </article>
  );
}

function formatUnitLabel(habit: HabitWithEntries): string {
  return `1 check = ${formatHabitUnit(habit, habit.unitMinutes)}`;
}

function formatHabitTotal(habit: HabitWithEntries): string {
  if (habit.unitType === "times") return `${habit.totalCount} times`;
  return formatMinutes(habit.totalMinutes);
}

function formatHabitUnit(habit: HabitWithEntries, minutes: number): string {
  if (habit.unitType === "times") return "1 time";
  return formatMinutes(minutes);
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (hours === 0) return `${restMinutes}m`;
  if (restMinutes === 0) return `${hours}h`;
  return `${hours}h ${restMinutes}m`;
}
