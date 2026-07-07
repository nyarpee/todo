"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import { arrayMove } from "@dnd-kit/sortable";
import {
  addHabit,
  addHabitEntry,
  deleteHabit,
  rebalanceHabitEntriesForUnit,
  removeHabitEntry,
  reorderHabits,
  updateHabit,
} from "@/lib/habit-actions";
import { getTodayKey } from "@/lib/date-utils";
import {
  addTask,
  deleteTask,
  renameTask,
  syncAncestorCompletion,
  toggleTaskAndSyncAncestors,
  updateTaskDescription,
  updateTaskPriority,
  updateTaskSchedule,
} from "@/lib/task-actions";
import { createSampleTasks } from "@/lib/sample-tasks";
import { getBrowserSupabaseClient } from "@/lib/supabase-client";
import { pullSupabaseSnapshot, pushLocalSnapshotToSupabase } from "@/lib/supabase-sync";
import { mergeSyncSnapshots } from "@/lib/sync-merge";
import { createGroup, createDefaultGroups, DEFAULT_MY_TASKS_GROUP_ID } from "@/lib/task-groups";
import { buildTaskTree, flattenTaskTree } from "@/lib/task-tree";
import { IndexedDbActivityEventRepository } from "@/repositories/indexed-db-activity-event-repository";
import { IndexedDbGroupRepository } from "@/repositories/indexed-db-group-repository";
import { IndexedDbHabitRepository } from "@/repositories/indexed-db-habit-repository";
import { IndexedDbSyncQueueRepository } from "@/repositories/indexed-db-sync-queue-repository";
import { IndexedDbTaskRepository } from "@/repositories/indexed-db-task-repository";
import { LOCAL_USER_ID } from "@/repositories/task-repository";
import type { ActivityEntityId, ActivityEntityType, ActivityEventType } from "@/types/activity";
import type { Habit, HabitColor, HabitEntry, HabitEntryId, HabitId, HabitUnitType } from "@/types/habit";
import type { Task, TaskGroup, TaskGroupId, TaskId, TaskNode } from "@/types/task";
import { AccountMenu } from "./AccountMenu";
import { CalendarTabView } from "./CalendarTabView";
import { DatePickerView } from "./DatePickerView";
import { DraggableBottomSheet } from "./DraggableBottomSheet";
import { GroupBar } from "./GroupBar";
import { GroupEditorSheet } from "./GroupEditorSheet";
import { HabitEditorSheet } from "./HabitEditorSheet";
import { HabitTabView } from "./HabitTabView";
import { MindMapView } from "./MindMapView";
import {
  FloatingAddButton,
  QuickAddSheet,
  type QuickAddDraft,
} from "./QuickAddSheet";
import { TaskDetailView } from "./TaskDetailView";
import { TaskListView } from "./TaskListView";
import { ThemeToggle } from "./ThemeToggle";

export function TaskApp() {
  const repository = useMemo(() => new IndexedDbTaskRepository(), []);
  const groupRepository = useMemo(() => new IndexedDbGroupRepository(), []);
  const habitRepository = useMemo(() => new IndexedDbHabitRepository(), []);
  const activityRepository = useMemo(() => new IndexedDbActivityEventRepository(), []);
  const syncQueueRepository = useMemo(() => new IndexedDbSyncQueueRepository(), []);
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitEntries, setHabitEntries] = useState<HabitEntry[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<TaskGroupId>(DEFAULT_MY_TASKS_GROUP_ID);
  const [isLoaded, setIsLoaded] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [hasLoadedTheme, setHasLoadedTheme] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>("inbox");
  const [selectedTaskId, setSelectedTaskId] = useState<TaskId | null>(null);
  const [datePickerTaskId, setDatePickerTaskId] = useState<TaskId | null>(null);
  const [mindMapRootId, setMindMapRootId] = useState<TaskId | null>(null);
  const [detailReturnTarget, setDetailReturnTarget] = useState<"list" | "mindmap">("list");
  const [autoEditTaskId, setAutoEditTaskId] = useState<TaskId | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [groupEditorMode, setGroupEditorMode] = useState<"create" | "menu" | null>(null);
  const [habitEditorMode, setHabitEditorMode] = useState<"create" | "edit" | null>(null);
  const [editingHabitId, setEditingHabitId] = useState<HabitId | null>(null);
  const [activeDragTaskId, setActiveDragTaskId] = useState<TaskId | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const groupHoverTimerRef = useRef<number | null>(null);
  const hoveredGroupIdRef = useRef<TaskGroupId | null>(null);
  const edgeSwitchTimerRef = useRef<number | null>(null);
  const edgeSwitchDirectionRef = useRef<"previous" | "next" | null>(null);
  const dragStartXRef = useRef<number | null>(null);
  const dragStartYRef = useRef<number | null>(null);
  const latestPointerRef = useRef<{ x: number; y: number } | null>(null);
  const dragTargetGroupIdRef = useRef<TaskGroupId | null>(null);
  const groupChipsContainerRef = useRef<HTMLDivElement | null>(null);
  const groupChipRefs = useRef(new Map<TaskGroupId, HTMLButtonElement>());
  const groupChipsScrollTimerRef = useRef<number | null>(null);
  const groupChipsScrollDirectionRef = useRef<"left" | "right" | null>(null);
  const lastSyncedFingerprintRef = useRef<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 180,
        tolerance: 8,
      },
    }),
  );

  const roots = useMemo(() => buildTaskTree(tasks), [tasks]);
  const allNodes = useMemo(() => flattenTaskTree(roots), [roots]);
  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? groups[0] ?? null;
  const activeGroupRoots = useMemo(
    () => roots.filter((root) => root.groupId === activeGroupId),
    [activeGroupId, roots],
  );
  const activeRoots = useMemo(
    () => activeGroupRoots.filter((root) => !root.completed),
    [activeGroupRoots],
  );
  const completedRoots = useMemo(
    () =>
      activeGroupRoots
        .filter((root) => root.completed)
        .slice()
        .sort(sortCompletedTasks),
    [activeGroupRoots],
  );
  const selectedTask = selectedTaskId
    ? allNodes.find((node) => node.id === selectedTaskId) ?? null
    : null;
  const datePickerTask = datePickerTaskId
    ? allNodes.find((node) => node.id === datePickerTaskId) ?? null
    : null;
  const selectedParent = selectedTask ? findParentNode(allNodes, selectedTask) : null;
  const selectedPath = selectedTask ? buildNodePath(allNodes, selectedTask) : [];
  const mindMapRoot = mindMapRootId
    ? roots.find((root) => root.id === mindMapRootId) ?? null
    : null;
  const activeDragTask = activeDragTaskId
    ? allNodes.find((node) => node.id === activeDragTaskId) ?? null
    : null;
  const habitsWithEntries = useMemo(
    () =>
      habits
        .slice()
        .sort(sortHabitsByOrder)
        .map((habit) => {
          const entries = habitEntries
            .filter((entry) => entry.habitId === habit.id)
            .sort((first, second) => first.createdAt.localeCompare(second.createdAt));

          return {
            ...habit,
            entries,
            totalMinutes: entries.reduce((sum, entry) => sum + entry.minutes, 0),
            totalCount: entries.length,
          };
        }),
    [habitEntries, habits],
  );
  const editingHabit = editingHabitId
    ? habits.find((habit) => habit.id === editingHabitId) ?? null
    : null;
  const showQuickAdd =
    isLoaded &&
    selectedTask === null &&
    datePickerTask === null &&
    mindMapRoot === null &&
    groupEditorMode === null &&
    habitEditorMode === null;

  useEffect(() => {
    let isActive = true;

    async function loadTasks() {
      const storedTasks = await repository.listTasks(LOCAL_USER_ID);
      const storedGroups = await groupRepository.listGroups(LOCAL_USER_ID);
      const storedHabits = await habitRepository.listHabits(LOCAL_USER_ID);
      const storedHabitEntries = await habitRepository.listHabitEntries(LOCAL_USER_ID);
      const nextGroups = storedGroups.length > 0
        ? storedGroups
        : createDefaultGroups(LOCAL_USER_ID);
      const nextTasksBeforeDateRollover =
        storedTasks.length > 0 ? storedTasks : createSampleTasks(LOCAL_USER_ID);
      const nextTasks = rolloverIncompletePastTasks(nextTasksBeforeDateRollover);

      if (!isActive) return;

      setTasks(nextTasks);
      setGroups(nextGroups);
      setHabits(storedHabits);
      setHabitEntries(storedHabitEntries);
      setActiveGroupId(nextGroups[0]?.id ?? DEFAULT_MY_TASKS_GROUP_ID);
      setIsLoaded(true);

      if (storedTasks.length === 0) {
        await repository.saveTasks(LOCAL_USER_ID, nextTasks);
      }
      if (storedGroups.length === 0) {
        await groupRepository.saveGroups(LOCAL_USER_ID, nextGroups);
      }
    }

    void loadTasks();

    return () => {
      isActive = false;
    };
  }, [groupRepository, habitRepository, repository]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (hasLoadedTheme) {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  }, [hasLoadedTheme, theme]);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
    }
    setHasLoadedTheme(true);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    let isActive = true;

    async function loadSession() {
      const { data } = await client.auth.getSession();
      if (isActive) {
        setAuthUser(data.session?.user ?? null);
      }
    }

    void loadSession();

    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
      lastSyncedFingerprintRef.current = null;
      setSyncStatus(session?.user ? "Cloud sync ready" : null);
    });

    return () => {
      isActive = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!isLoaded) return;
    void repository.saveTasks(LOCAL_USER_ID, tasks);
  }, [isLoaded, repository, tasks]);

  useEffect(() => {
    if (!isLoaded) return;
    void groupRepository.saveGroups(LOCAL_USER_ID, groups);
  }, [groupRepository, groups, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    void habitRepository.saveHabits(LOCAL_USER_ID, habits);
  }, [habitRepository, habits, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    void habitRepository.saveHabitEntries(LOCAL_USER_ID, habitEntries);
  }, [habitEntries, habitRepository, isLoaded]);

  useEffect(() => {
    if (groups.length === 0) return;
    if (groups.some((group) => group.id === activeGroupId)) return;
    setActiveGroupId(groups[0]?.id ?? DEFAULT_MY_TASKS_GROUP_ID);
  }, [activeGroupId, groups]);

  useEffect(() => {
    if (!isLoaded || !authUser || !supabase) return;

    const fingerprint = buildSyncFingerprint(groups, tasks, habits, habitEntries);
    if (fingerprint === lastSyncedFingerprintRef.current) return;

    const timeoutId = window.setTimeout(() => {
      void syncLocalDataToCloud(fingerprint);
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [authUser, groups, habitEntries, habits, isLoaded, supabase, tasks]);

  useEffect(() => () => {
    clearGroupHoverTimer();
    clearEdgeSwitchTimer();
  }, []);

  function handleTabChange(nextTab: AppTab) {
    setActiveTab(nextTab);
    setSelectedTaskId(null);
    setDatePickerTaskId(null);
    setMindMapRootId(null);
    setDetailReturnTarget("list");
  }

  async function syncLocalDataToCloud(fingerprint: string) {
    if (!authUser || !supabase) return;

    try {
      setSyncStatus("Syncing...");
      const [activityEvents, pendingSyncItems] = await Promise.all([
        activityRepository.listEvents(LOCAL_USER_ID),
        syncQueueRepository.listPendingItems(LOCAL_USER_ID),
      ]);
      const pulledSnapshot = await pullSupabaseSnapshot(supabase, authUser.id);
      const mergedSnapshot = mergeSyncSnapshots({
        local: {
          groups,
          tasks,
          habits,
          habitEntries,
          activityEvents,
        },
        remote: pulledSnapshot,
      });

      const syncedQueueItemIds = await pushLocalSnapshotToSupabase(supabase, authUser.id, {
        groups: mergedSnapshot.groups,
        tasks: mergedSnapshot.tasks,
        habits: mergedSnapshot.habits,
        habitEntries: mergedSnapshot.habitEntries,
        activityEvents: mergedSnapshot.activityEvents,
        pendingSyncItems,
      });

      await syncQueueRepository.markItemsSynced(LOCAL_USER_ID, syncedQueueItemIds);
      const pulledFingerprint = buildSyncFingerprint(
        mergedSnapshot.groups,
        mergedSnapshot.tasks,
        mergedSnapshot.habits,
        mergedSnapshot.habitEntries,
      );

      lastSyncedFingerprintRef.current = pulledFingerprint || fingerprint;
      await activityRepository.saveEvents(LOCAL_USER_ID, mergedSnapshot.activityEvents);
      setGroups(mergedSnapshot.groups);
      setTasks(mergedSnapshot.tasks);
      setHabits(mergedSnapshot.habits);
      setHabitEntries(mergedSnapshot.habitEntries);
      setSyncStatus("Synced with cloud");
    } catch (error) {
      const message = getSyncErrorMessage(error);
      console.error("Cloud sync failed", error);
      setSyncStatus(`Cloud sync failed: ${message}`);
    }
  }

  function recordActivity(
    type: ActivityEventType,
    entityType: ActivityEntityType,
    entityId: ActivityEntityId,
    payload: Record<string, unknown> = {},
  ) {
    const now = new Date().toISOString();
    const clientId = getClientId();
    const event = {
      id: crypto.randomUUID(),
      userId: LOCAL_USER_ID,
      type,
      entityType,
      entityId,
      clientId,
      payload,
      createdAt: now,
    };

    void activityRepository.addEvent(event);
    void syncQueueRepository.enqueueItem({
      id: crypto.randomUUID(),
      userId: LOCAL_USER_ID,
      activityEventId: event.id,
      entityType,
      entityId,
      operation: type,
      payload,
      clientId,
      status: "pending",
      attempts: 0,
      createdAt: now,
      updatedAt: now,
      syncedAt: null,
      lastError: null,
    });
  }

  function handleAddTask(draft?: QuickAddDraft) {
    const taskId = crypto.randomUUID();

    setTasks((currentTasks) =>
      addTask(currentTasks, {
        userId: LOCAL_USER_ID,
        title: draft?.title ?? TEXT.newTask,
        parentId: null,
        groupId: activeGroupId,
        dueDate: draft?.dueDate ?? null,
        dueTime: draft?.dueTime ?? null,
        priority: draft?.priority ?? "none",
      }, {
        generateId: () => taskId,
      }),
    );

    if (!draft) {
      setAutoEditTaskId(taskId);
    }

    recordActivity("task_created", "task", taskId, {
      groupId: activeGroupId,
      hasDraft: Boolean(draft),
    });
    setIsQuickAddOpen(false);
  }

  function handleAddChild(parentId: TaskId, draft?: QuickAddDraft) {
    const taskId = crypto.randomUUID();
    const title = draft?.title ?? TEXT.newTask;

    setTasks((currentTasks) => {
      const nextTasks = addTask(currentTasks, {
        userId: LOCAL_USER_ID,
        title,
        parentId,
        dueDate: draft?.dueDate ?? null,
        dueTime: draft?.dueTime ?? null,
        priority: draft?.priority ?? "none",
      }, {
        generateId: () => taskId,
      });

      return syncAncestorCompletion(nextTasks, taskId);
    });
    if (!draft) {
      setAutoEditTaskId(taskId);
    }
    recordActivity("task_created", "task", taskId, { parentId });
  }

  function handleAddGroup(name: string) {
    const now = new Date().toISOString();
    const group = createGroup(
      crypto.randomUUID(),
      LOCAL_USER_ID,
      name,
      groups.length,
      now,
    );

    setGroups((currentGroups) => [...currentGroups, group]);
    setActiveGroupId(group.id);
    setGroupEditorMode(null);
    recordActivity("group_created", "task_group", group.id, { name });
  }

  function handleRenameGroup(name: string) {
    if (!activeGroup) return;

    setGroups((currentGroups) =>
      currentGroups.map((group) =>
        group.id === activeGroup.id
          ? { ...group, name, updatedAt: new Date().toISOString() }
          : group,
      ),
    );
    setGroupEditorMode(null);
    recordActivity("group_updated", "task_group", activeGroup.id, {
      name,
      fields: ["name"],
    });
  }

  function handleDeleteGroup() {
    if (!activeGroup || activeGroup.id === DEFAULT_MY_TASKS_GROUP_ID) return;

    const deletedGroupId = activeGroup.id;
    const nextActiveGroup = groups.find((group) => group.id !== deletedGroupId);

    setGroups((currentGroups) =>
      currentGroups
        .filter((group) => group.id !== deletedGroupId)
        .map((group, index) => ({ ...group, order: index })),
    );
    setTasks((currentTasks) =>
      currentTasks.filter((task) => task.groupId !== deletedGroupId),
    );
    setActiveGroupId(nextActiveGroup?.id ?? DEFAULT_MY_TASKS_GROUP_ID);
    setGroupEditorMode(null);
    recordActivity("group_deleted", "task_group", deletedGroupId);
  }

  function handleToggleComplete(taskId: TaskId) {
    const task = allNodes.find((node) => node.id === taskId);
    setTasks((currentTasks) => toggleTaskAndSyncAncestors(currentTasks, taskId));
    recordActivity(
      task?.completed ? "task_uncompleted" : "task_completed",
      "task",
      taskId,
      { fields: ["completed", "completedAt"] },
    );
  }

  function handleRenameTask(taskId: TaskId, title: string) {
    setTasks((currentTasks) => renameTask(currentTasks, taskId, title));
    recordActivity("task_updated", "task", taskId, { field: "title", fields: ["title"] });
  }

  function handleUpdateDescription(taskId: TaskId, description: string) {
    setTasks((currentTasks) =>
      updateTaskDescription(currentTasks, taskId, description),
    );
    recordActivity("task_updated", "task", taskId, {
      field: "description",
      fields: ["description"],
    });
  }

  function handleUpdatePriority(taskId: TaskId, priority: Task["priority"]) {
    setTasks((currentTasks) =>
      updateTaskPriority(currentTasks, taskId, priority),
    );
    recordActivity("task_priority_changed", "task", taskId, {
      priority,
      fields: ["priority"],
    });
  }

  function handleSaveSchedule(
    taskId: TaskId,
    dueDate: string | null,
    dueTime: string | null,
  ) {
    setTasks((currentTasks) =>
      updateTaskSchedule(currentTasks, taskId, dueDate, dueTime),
    );
    setDatePickerTaskId(null);
    recordActivity("task_scheduled", "task", taskId, {
      dueDate,
      dueTime,
      fields: ["dueDate", "dueTime"],
    });
  }

  function handleDeleteTask(taskId: TaskId) {
    const deletedTask = allNodes.find((node) => node.id === taskId) ?? null;

    setTasks((currentTasks) => deleteTask(currentTasks, taskId));

    if (selectedTaskId === taskId) {
      setSelectedTaskId(
        detailReturnTarget === "mindmap" ? null : deletedTask?.parentId ?? null,
      );
    }

    if (mindMapRootId === taskId) {
      setMindMapRootId(null);
    }
    recordActivity("task_deleted", "task", taskId);
  }

  function handleAddHabit(
    title: string,
    unitType: HabitUnitType,
    unitMinutes: number,
    color: HabitColor,
  ) {
    const habitId = crypto.randomUUID();

    setHabits((currentHabits) =>
      addHabit(currentHabits, {
        userId: LOCAL_USER_ID,
        title,
        unitType,
        unitMinutes,
        color,
      }, {
        generateId: () => habitId,
      }),
    );
    setHabitEditorMode(null);
    recordActivity("habit_created", "habit", habitId, { title, unitType, unitMinutes, color });
  }

  function handleUpdateHabit(
    title: string,
    unitType: HabitUnitType,
    unitMinutes: number,
    color: HabitColor,
  ) {
    if (!editingHabit) return;

    if (editingHabit.unitType !== unitType || editingHabit.unitMinutes !== unitMinutes) {
      setHabitEntries((currentEntries) =>
        rebalanceHabitEntriesForUnit(currentEntries, editingHabit, unitType, unitMinutes),
      );
    }

    setHabits((currentHabits) =>
      updateHabit(currentHabits, editingHabit.id, { title, unitType, unitMinutes, color }),
    );
    setHabitEditorMode(null);
    setEditingHabitId(null);
    recordActivity("habit_updated", "habit", editingHabit.id, {
      title,
      unitType,
      unitMinutes,
      color,
      fields: ["title", "unitType", "unitMinutes", "color"],
    });
  }

  function handleDeleteHabit() {
    if (!editingHabit) return;

    const nextState = deleteHabit(habits, habitEntries, editingHabit.id);
    setHabits(nextState.habits);
    setHabitEntries(nextState.entries);
    setHabitEditorMode(null);
    setEditingHabitId(null);
    recordActivity("habit_deleted", "habit", editingHabit.id);
  }

  function handleCheckHabit(habitId: HabitId) {
    const habit = habits.find((item) => item.id === habitId);
    if (!habit) return;

    const entryId = crypto.randomUUID();
    setHabitEntries((currentEntries) =>
      addHabitEntry(currentEntries, habit, { generateId: () => entryId }),
    );
    recordActivity("habit_checked", "habit_entry", entryId, { habitId });
  }

  function handleUncheckHabit(entryId: HabitEntryId) {
    const entry = habitEntries.find((item) => item.id === entryId);
    setHabitEntries((currentEntries) => removeHabitEntry(currentEntries, entryId));
    recordActivity("habit_unchecked", "habit_entry", entryId, {
      habitId: entry?.habitId ?? null,
    });
  }

  function handleOpenHabitMenu(habitId: HabitId) {
    setEditingHabitId(habitId);
    setHabitEditorMode("edit");
  }

  function handleReorderHabits(activeId: HabitId, overId: HabitId) {
    const orderedIds = habits
      .slice()
      .sort(sortHabitsByOrder)
      .map((habit) => habit.id);
    const oldIndex = orderedIds.indexOf(activeId);
    const newIndex = orderedIds.indexOf(overId);

    if (oldIndex < 0 || newIndex < 0) return;

    setHabits((currentHabits) =>
      reorderHabits(currentHabits, arrayMove(orderedIds, oldIndex, newIndex)),
    );
    recordActivity("habit_reordered", "habit", activeId, { overId, fields: ["order"] });
  }

  function handleDragStart(event: DragStartEvent) {
    const pointerX = getPointerClientX(event.activatorEvent);
    const pointerY = getPointerClientY(event.activatorEvent);

    setActiveDragTaskId(String(event.active.id));
    dragStartXRef.current = pointerX;
    dragStartYRef.current = pointerY;
    latestPointerRef.current =
      pointerX === null || pointerY === null ? null : { x: pointerX, y: pointerY };
    dragTargetGroupIdRef.current = activeGroupId;
    startPointerTracking();
  }

  function handleDragMove(event: DragMoveEvent) {
    const pointer = getCurrentDragPointer(event);
    if (!pointer) return;
    handleDragPointerMove(pointer.x, pointer.y);
  }

  function handleDragEnd(event: DragEndEvent) {
    clearGroupHoverTimer();
    clearEdgeSwitchTimer();
    clearGroupChipsScrollTimer();
    stopPointerTracking();
    setActiveDragTaskId(null);
    dragStartXRef.current = null;
    dragStartYRef.current = null;
    latestPointerRef.current = null;

    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;

    const draggedTask = allNodes.find((node) => node.id === activeId);
    if (!draggedTask || draggedTask.parentId !== null || draggedTask.completed) return;

    if (!overId) {
      if (dragTargetGroupIdRef.current) {
        moveRootTaskToGroupEnd(activeId, dragTargetGroupIdRef.current);
        recordActivity("task_moved", "task", activeId, {
          groupId: dragTargetGroupIdRef.current,
          fields: ["groupId", "parentId", "order"],
        });
      }
      dragTargetGroupIdRef.current = null;
      return;
    }

    const overTask = allNodes.find((node) => node.id === overId);
    if (!overTask || overTask.parentId !== null || overTask.completed) return;

    moveRootTaskBefore(activeId, overTask.id, overTask.groupId);
    recordActivity("task_moved", "task", activeId, {
      groupId: overTask.groupId,
      beforeTaskId: overTask.id,
      fields: ["groupId", "parentId", "order"],
    });
    dragTargetGroupIdRef.current = null;
  }

  function handleDragCancel() {
    clearGroupHoverTimer();
    clearEdgeSwitchTimer();
    clearGroupChipsScrollTimer();
    stopPointerTracking();
    setActiveDragTaskId(null);
    dragStartXRef.current = null;
    dragStartYRef.current = null;
    latestPointerRef.current = null;
    dragTargetGroupIdRef.current = null;
  }

  function handleRegisterGroupChipsContainer(element: HTMLDivElement | null) {
    groupChipsContainerRef.current = element;
  }

  function handleRegisterGroupChip(groupId: TaskGroupId, element: HTMLButtonElement | null) {
    if (element) {
      groupChipRefs.current.set(groupId, element);
      return;
    }

    groupChipRefs.current.delete(groupId);
  }

  function startPointerTracking() {
    window.addEventListener("pointermove", handleTrackedPointerMove, { passive: true });
    window.addEventListener("touchmove", handleTrackedTouchMove, { passive: true });
  }

  function stopPointerTracking() {
    window.removeEventListener("pointermove", handleTrackedPointerMove);
    window.removeEventListener("touchmove", handleTrackedTouchMove);
  }

  function handleTrackedPointerMove(event: PointerEvent) {
    latestPointerRef.current = { x: event.clientX, y: event.clientY };
  }

  function handleTrackedTouchMove(event: TouchEvent) {
    const touch = event.touches[0] ?? event.changedTouches[0] ?? null;
    if (!touch) return;
    latestPointerRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function getCurrentDragPointer(event: DragMoveEvent): { x: number; y: number } | null {
    if (latestPointerRef.current) return latestPointerRef.current;
    if (dragStartXRef.current === null || dragStartYRef.current === null) return null;

    return {
      x: dragStartXRef.current + event.delta.x,
      y: dragStartYRef.current + event.delta.y,
    };
  }

  function handleDragPointerMove(pointerX: number, pointerY: number) {
    scheduleEdgeGroupSwitch(pointerX);
    scheduleGroupChipsHorizontalScroll(pointerX, pointerY);

    const overGroupId = findGroupIdAtPoint(pointerX, pointerY);
    if (!overGroupId) {
      clearGroupHoverTimer();
      return;
    }

    scheduleGroupHoverSwitch(overGroupId);
  }

  function moveRootTaskBefore(taskId: TaskId, overTaskId: TaskId, destinationGroupId: TaskGroupId) {
    setTasks((currentTasks) => {
      const draggedTask = currentTasks.find((task) => task.id === taskId);
      if (!draggedTask) return currentTasks;

      const destinationRoots = currentTasks
        .filter(
          (task) =>
            task.parentId === null &&
            task.groupId === destinationGroupId &&
            !task.completed,
        )
        .sort(sortTasksByOrder);
      const oldIndex = destinationRoots.findIndex((task) => task.id === taskId);
      const overIndex = destinationRoots.findIndex((task) => task.id === overTaskId);

      if (overIndex < 0) return currentTasks;

      const orderedRoots =
        oldIndex >= 0
          ? arrayMove(destinationRoots, oldIndex, overIndex)
          : insertTaskAt(destinationRoots, { ...draggedTask, groupId: destinationGroupId }, overIndex);

      return applyRootOrderAndGroup(currentTasks, taskId, destinationGroupId, orderedRoots);
    });
  }

  function moveRootTaskToGroupEnd(taskId: TaskId, destinationGroupId: TaskGroupId) {
    setTasks((currentTasks) => {
      const draggedTask = currentTasks.find((task) => task.id === taskId);
      if (!draggedTask) return currentTasks;

      const destinationRoots = currentTasks
        .filter(
          (task) =>
            task.parentId === null &&
            task.groupId === destinationGroupId &&
            !task.completed &&
            task.id !== taskId,
        )
        .sort(sortTasksByOrder);
      const orderedRoots = [...destinationRoots, { ...draggedTask, groupId: destinationGroupId }];

      return applyRootOrderAndGroup(currentTasks, taskId, destinationGroupId, orderedRoots);
    });
  }

  function clearGroupHoverTimer() {
    if (groupHoverTimerRef.current) {
      window.clearTimeout(groupHoverTimerRef.current);
    }
    groupHoverTimerRef.current = null;
    hoveredGroupIdRef.current = null;
  }

  function scheduleGroupHoverSwitch(groupId: TaskGroupId) {
    if (groupId === activeGroupId) {
      clearGroupHoverTimer();
      dragTargetGroupIdRef.current = groupId;
      return;
    }

    if (hoveredGroupIdRef.current === groupId) return;

    clearGroupHoverTimer();
    hoveredGroupIdRef.current = groupId;
    groupHoverTimerRef.current = window.setTimeout(() => {
      setActiveGroupId(groupId);
      dragTargetGroupIdRef.current = groupId;
      clearGroupHoverTimer();
    }, GROUP_HOVER_SWITCH_DELAY_MS);
  }

  function findGroupIdAtPoint(pointerX: number, pointerY: number): TaskGroupId | null {
    for (const [groupId, element] of groupChipRefs.current) {
      const rect = element.getBoundingClientRect();
      if (
        pointerX >= rect.left &&
        pointerX <= rect.right &&
        pointerY >= rect.top &&
        pointerY <= rect.bottom
      ) {
        return groupId;
      }
    }

    return null;
  }

  function scheduleGroupChipsHorizontalScroll(pointerX: number, pointerY: number) {
    const container = groupChipsContainerRef.current;
    if (!container) {
      clearGroupChipsScrollTimer();
      return;
    }

    const rect = container.getBoundingClientRect();
    const isInsideY = pointerY >= rect.top && pointerY <= rect.bottom;
    const nextDirection =
      isInsideY && pointerX <= rect.left + GROUP_CHIPS_SCROLL_ZONE_PX
        ? "left"
        : isInsideY && pointerX >= rect.right - GROUP_CHIPS_SCROLL_ZONE_PX
          ? "right"
          : null;

    if (!nextDirection) {
      clearGroupChipsScrollTimer();
      return;
    }

    if (groupChipsScrollDirectionRef.current === nextDirection) return;

    clearGroupChipsScrollTimer();
    groupChipsScrollDirectionRef.current = nextDirection;
    groupChipsScrollTimerRef.current = window.setInterval(() => {
      const direction = groupChipsScrollDirectionRef.current;
      const latestPointer = latestPointerRef.current;
      const chipsContainer = groupChipsContainerRef.current;
      if (!direction || !latestPointer || !chipsContainer) return;

      chipsContainer.scrollLeft += direction === "left"
        ? -GROUP_CHIPS_SCROLL_STEP_PX
        : GROUP_CHIPS_SCROLL_STEP_PX;
      handleDragPointerMove(latestPointer.x, latestPointer.y);
    }, GROUP_CHIPS_SCROLL_INTERVAL_MS);
  }

  function clearGroupChipsScrollTimer() {
    if (groupChipsScrollTimerRef.current) {
      window.clearInterval(groupChipsScrollTimerRef.current);
    }
    groupChipsScrollTimerRef.current = null;
    groupChipsScrollDirectionRef.current = null;
  }

  function scheduleEdgeGroupSwitch(pointerX: number) {
    const direction = getEdgeSwitchDirection(pointerX, window.innerWidth);

    if (!direction) {
      clearEdgeSwitchTimer();
      return;
    }

    const nextGroupId = getAdjacentGroupId(groups, activeGroupId, direction);
    if (!nextGroupId) {
      clearEdgeSwitchTimer();
      return;
    }

    if (edgeSwitchDirectionRef.current === direction) return;

    clearEdgeSwitchTimer();
    edgeSwitchDirectionRef.current = direction;
    edgeSwitchTimerRef.current = window.setTimeout(() => {
      setActiveGroupId(nextGroupId);
      dragTargetGroupIdRef.current = nextGroupId;
      clearEdgeSwitchTimer();
    }, EDGE_SWITCH_DELAY_MS);
  }

  function clearEdgeSwitchTimer() {
    if (edgeSwitchTimerRef.current) {
      window.clearTimeout(edgeSwitchTimerRef.current);
    }
    edgeSwitchTimerRef.current = null;
    edgeSwitchDirectionRef.current = null;
  }

  function openListDetail(taskId: TaskId) {
    setActiveTab("inbox");
    setDetailReturnTarget("list");
    setSelectedTaskId(taskId);
  }

  function openMindMapDetail(taskId: TaskId) {
    setActiveTab("inbox");
    setDetailReturnTarget("mindmap");
    setSelectedTaskId(taskId);
  }

  function openCalendarDetail(taskId: TaskId) {
    setDetailReturnTarget("list");
    setSelectedTaskId(taskId);
  }

  return (
    <main className="appShell">
      <header className="appHeader">
        <div className="brand">
          <span className="brandMark" aria-hidden="true" />
          <h1>Todoapp</h1>
        </div>
        <div className="headerActions">
          <AccountMenu syncStatus={syncStatus} />
          <ThemeToggle
            theme={theme}
            onToggle={() => setTheme((currentTheme) =>
              currentTheme === "light" ? "dark" : "light"
            )}
          />
        </div>
      </header>

      {!isLoaded ? (
        <div className="loadingState">Loading</div>
      ) : activeTab === "calendar" ? (
        <CalendarTabView tasks={allNodes} onSelectTask={openCalendarDetail} />
      ) : activeTab === "habit" ? (
        <HabitTabView
          habits={habitsWithEntries}
          onCheck={handleCheckHabit}
          onOpenMenu={handleOpenHabitMenu}
          onReorder={handleReorderHabits}
          onUncheck={handleUncheckHabit}
        />
      ) : (
        <DndContext
          collisionDetection={closestCenter}
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <section className="workspace">
            <GroupBar
              groups={groups}
              activeGroupId={activeGroupId}
              onRegisterGroupChipsContainer={handleRegisterGroupChipsContainer}
              onRegisterGroupChip={handleRegisterGroupChip}
              onSelectGroup={setActiveGroupId}
              onAddGroup={() => setGroupEditorMode("create")}
              onOpenMenu={() => setGroupEditorMode("menu")}
            />
            {activeGroupRoots.length === 0 ? (
              <div className="emptyState compactEmpty">
                <p>{TEXT.empty}</p>
              </div>
            ) : null}
            {activeGroupRoots.length > 0 ? (
              <TaskListView
                roots={activeRoots}
                completedRoots={completedRoots}
                onSelectTask={openListDetail}
                onOpenMindMap={setMindMapRootId}
                onToggleComplete={handleToggleComplete}
                onRenameTask={handleRenameTask}
                onDeleteTask={handleDeleteTask}
                autoEditTaskId={autoEditTaskId}
                onAutoEditConsumed={() => setAutoEditTaskId(null)}
              />
            ) : null}
          </section>
          <DragOverlay modifiers={[snapCenterToCursor]}>
            {activeDragTask ? (
              <div className="dragOverlayTask">
                <span
                  className={`priorityDot taskPriorityDot ${activeDragTask.priority === "none" ? "priority-none" : `priority-${activeDragTask.priority}`}`}
                  aria-hidden="true"
                />
                <span>{activeDragTask.title}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
      {mindMapRoot ? (
        <DraggableBottomSheet
          ariaLabel="Task tree canvas"
          className="canvasSheet"
          onDismiss={() => setMindMapRootId(null)}
        >
          <MindMapView
            root={mindMapRoot}
            onAddChild={handleAddChild}
            onRenameTask={handleRenameTask}
            onDeleteTask={handleDeleteTask}
            autoEditTaskId={autoEditTaskId}
            onAutoEditConsumed={() => setAutoEditTaskId(null)}
            onSelectTask={openMindMapDetail}
            onToggleComplete={handleToggleComplete}
          />
        </DraggableBottomSheet>
      ) : null}
      {selectedTask ? (
        <DraggableBottomSheet
          ariaLabel="Task detail"
          className="detailSheet"
          dismissOnBackdrop
          initialOffset={88}
          onDismiss={() => setSelectedTaskId(null)}
        >
          <TaskDetailView
            task={selectedTask}
            parent={selectedParent}
            path={selectedPath}
            onSelectTask={setSelectedTaskId}
            onToggleComplete={handleToggleComplete}
            onRenameTask={handleRenameTask}
            onUpdateDescription={handleUpdateDescription}
            onUpdatePriority={handleUpdatePriority}
            onDeleteTask={handleDeleteTask}
            onOpenSchedule={setDatePickerTaskId}
            autoEditTaskId={autoEditTaskId}
            onAutoEditConsumed={() => setAutoEditTaskId(null)}
            onAddChild={handleAddChild}
          />
        </DraggableBottomSheet>
      ) : null}
      {datePickerTask ? (
        <DatePickerView
          task={datePickerTask}
          onBack={() => setDatePickerTaskId(null)}
          onSave={(dueDate, dueTime) =>
            handleSaveSchedule(datePickerTask.id, dueDate, dueTime)
          }
        />
      ) : null}
      {showQuickAdd ? (
        <FloatingAddButton
          onClick={() => {
            if (activeTab === "habit") {
              setHabitEditorMode("create");
              return;
            }
            setIsQuickAddOpen(true);
          }}
        />
      ) : null}
      <QuickAddSheet
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onSave={handleAddTask}
      />
      {groupEditorMode === "create" ? (
        <GroupEditorSheet
          mode="create"
          onDismiss={() => setGroupEditorMode(null)}
          onSave={handleAddGroup}
        />
      ) : null}
      {groupEditorMode === "menu" && activeGroup ? (
        <GroupEditorSheet
          mode="menu"
          group={activeGroup}
          taskCount={tasks.filter((task) => task.groupId === activeGroup.id).length}
          onDismiss={() => setGroupEditorMode(null)}
          onRename={handleRenameGroup}
          onDelete={handleDeleteGroup}
        />
      ) : null}
      {habitEditorMode === "create" ? (
        <HabitEditorSheet
          mode="create"
          onDismiss={() => setHabitEditorMode(null)}
          onSave={handleAddHabit}
        />
      ) : null}
      {habitEditorMode === "edit" && editingHabit ? (
        <HabitEditorSheet
          mode="edit"
          habit={editingHabit}
          entryCount={habitEntries.filter((entry) => entry.habitId === editingHabit.id).length}
          onDelete={handleDeleteHabit}
          onDismiss={() => {
            setHabitEditorMode(null);
            setEditingHabitId(null);
          }}
          onSave={handleUpdateHabit}
        />
      ) : null}
      {!datePickerTask && !mindMapRoot ? (
        <nav className="bottomTabs" aria-label="Primary">
          <button
            className={activeTab === "inbox" ? "bottomTab isActive" : "bottomTab"}
            type="button"
            onClick={() => handleTabChange("inbox")}
          >
            Inbox
          </button>
          <button
            className={activeTab === "calendar" ? "bottomTab isActive" : "bottomTab"}
            type="button"
            onClick={() => handleTabChange("calendar")}
          >
            Calendar
          </button>
          <button
            className={activeTab === "habit" ? "bottomTab isActive" : "bottomTab"}
            type="button"
            onClick={() => handleTabChange("habit")}
          >
            Habit
          </button>
        </nav>
      ) : null}
    </main>
  );
}

function sortCompletedTasks(first: TaskNode, second: TaskNode): number {
  const firstCompletedAt = first.completedAt ?? first.updatedAt;
  const secondCompletedAt = second.completedAt ?? second.updatedAt;
  return secondCompletedAt.localeCompare(firstCompletedAt);
}

const TEXT = {
  addTask: "\u30bf\u30b9\u30af\u3092\u8ffd\u52a0",
  newTask: "\u65b0\u3057\u3044\u30bf\u30b9\u30af",
  empty: "\u307e\u3060\u30bf\u30b9\u30af\u304c\u3042\u308a\u307e\u305b\u3093\u3002",
};

const THEME_STORAGE_KEY = "todoapp.theme";
const CLIENT_ID_STORAGE_KEY = "todoapp.client-id";
type AppTab = "inbox" | "calendar" | "habit";

const GROUP_HOVER_SWITCH_DELAY_MS = 600;
const EDGE_SWITCH_DELAY_MS = 650;
const EDGE_SWITCH_ZONE_PX = 28;
const GROUP_CHIPS_SCROLL_ZONE_PX = 34;
const GROUP_CHIPS_SCROLL_STEP_PX = 7;
const GROUP_CHIPS_SCROLL_INTERVAL_MS = 24;

function findParentNode(nodes: TaskNode[], task: TaskNode): TaskNode | null {
  if (!task.parentId) return null;
  return nodes.find((node) => node.id === task.parentId) ?? null;
}

function buildNodePath(nodes: TaskNode[], task: TaskNode): TaskNode[] {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const path: TaskNode[] = [];
  let current: TaskNode | undefined = task;

  while (current) {
    path.unshift(current);
    current = current.parentId ? nodesById.get(current.parentId) : undefined;
  }

  return path;
}

function sortTasksByOrder(first: Task, second: Task): number {
  return first.order - second.order || first.createdAt.localeCompare(second.createdAt);
}

function rolloverIncompletePastTasks(tasks: Task[]): Task[] {
  const todayKey = getTodayKey();
  const now = new Date().toISOString();

  return tasks.map((task) => {
    if (task.completed || task.dueDate === null || task.dueDate >= todayKey) return task;

    return {
      ...task,
      dueDate: todayKey,
      updatedAt: now,
    };
  });
}

function sortHabitsByOrder(first: Habit, second: Habit): number {
  return first.order - second.order || first.createdAt.localeCompare(second.createdAt);
}

function insertTaskAt(tasks: Task[], task: Task, index: number): Task[] {
  const nextTasks = tasks.filter((item) => item.id !== task.id);
  nextTasks.splice(index, 0, task);
  return nextTasks;
}

function applyRootOrderAndGroup(
  tasks: Task[],
  movedTaskId: TaskId,
  destinationGroupId: TaskGroupId,
  orderedDestinationRoots: Task[],
): Task[] {
  const now = new Date().toISOString();
  const destinationOrderById = new Map(
    orderedDestinationRoots.map((task, index) => [task.id, index]),
  );
  const descendantIds = collectDescendantIds(tasks, movedTaskId);

  return tasks.map((task) => {
    const isMovedTree = task.id === movedTaskId || descendantIds.has(task.id);
    const destinationOrder = destinationOrderById.get(task.id);

    if (!isMovedTree && destinationOrder === undefined) return task;

    return {
      ...task,
      groupId: isMovedTree ? destinationGroupId : task.groupId,
      parentId: task.id === movedTaskId ? null : task.parentId,
      order: destinationOrder ?? task.order,
      updatedAt: now,
    };
  });
}

function collectDescendantIds(tasks: Task[], taskId: TaskId): Set<TaskId> {
  const descendants = new Set<TaskId>();
  const queue = tasks.filter((task) => task.parentId === taskId).map((task) => task.id);

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || descendants.has(currentId)) continue;

    descendants.add(currentId);
    queue.push(...tasks.filter((task) => task.parentId === currentId).map((task) => task.id));
  }

  return descendants;
}

function getPointerClientX(event: Event): number | null {
  if ("clientX" in event && typeof event.clientX === "number") {
    return event.clientX;
  }

  if (hasTouchList(event, "touches") && event.touches.length > 0) {
    return event.touches[0]?.clientX ?? null;
  }

  if (hasTouchList(event, "changedTouches") && event.changedTouches.length > 0) {
    return event.changedTouches[0]?.clientX ?? null;
  }

  return null;
}

function getPointerClientY(event: Event): number | null {
  if ("clientY" in event && typeof event.clientY === "number") {
    return event.clientY;
  }

  if (hasTouchList(event, "touches") && event.touches.length > 0) {
    return event.touches[0]?.clientY ?? null;
  }

  if (hasTouchList(event, "changedTouches") && event.changedTouches.length > 0) {
    return event.changedTouches[0]?.clientY ?? null;
  }

  return null;
}

function hasTouchList(
  event: Event,
  key: "touches" | "changedTouches",
): event is Event & Record<typeof key, TouchList> {
  const value = (event as unknown as Record<string, unknown>)[key];
  return value instanceof TouchList;
}

function getEdgeSwitchDirection(
  pointerX: number,
  viewportWidth: number,
): "previous" | "next" | null {
  if (pointerX <= EDGE_SWITCH_ZONE_PX) return "previous";
  if (pointerX >= viewportWidth - EDGE_SWITCH_ZONE_PX) return "next";
  return null;
}

function getAdjacentGroupId(
  groups: TaskGroup[],
  activeGroupId: TaskGroupId,
  direction: "previous" | "next",
): TaskGroupId | null {
  const activeIndex = groups.findIndex((group) => group.id === activeGroupId);
  if (activeIndex < 0) return null;

  const nextIndex = direction === "previous" ? activeIndex - 1 : activeIndex + 1;
  return groups[nextIndex]?.id ?? null;
}

function buildSyncFingerprint(
  groups: TaskGroup[],
  tasks: Task[],
  habits: Habit[],
  habitEntries: HabitEntry[],
): string {
  return JSON.stringify({
    groups: groups.map((group) => [
      group.id,
      group.name,
      group.order,
      group.updatedAt,
    ]),
    tasks: tasks.map((task) => [
      task.id,
      task.groupId,
      task.parentId,
      task.title,
      task.description,
      task.order,
      task.completed,
      task.completedAt,
      task.priority,
      task.dueDate,
      task.dueTime,
      task.updatedAt,
    ]),
    habits: habits.map((habit) => [
      habit.id,
      habit.title,
      habit.unitType,
      habit.unitMinutes,
      habit.color,
      habit.order,
      habit.updatedAt,
    ]),
    habitEntries: habitEntries.map((entry) => [
      entry.id,
      entry.habitId,
      entry.minutes,
      entry.checkedAt,
      entry.createdAt,
    ]),
  });
}

function getClientId(): string {
  const storedClientId = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (storedClientId) return storedClientId;

  const clientId = crypto.randomUUID();
  window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId);
  return clientId;
}

function getSyncErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;

  if (error && typeof error === "object") {
    const maybeError = error as {
      message?: unknown;
      code?: unknown;
      details?: unknown;
      hint?: unknown;
    };
    const parts = [
      maybeError.message,
      maybeError.code ? `code: ${maybeError.code}` : null,
      maybeError.details,
      maybeError.hint,
    ].filter((part): part is string => typeof part === "string" && part.length > 0);

    if (parts.length > 0) return parts.join(" / ");
  }

  return "Unknown error";
}
