"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  closestCenter,
  pointerWithin,
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import { arrayMove } from "@dnd-kit/sortable";
import { RefreshCw } from "lucide-react";
import {
  applyGroupActivityEvent,
  applyHabitActivityEvent,
  applyHabitEntryActivityEvent,
  applyTaskActivityEvent,
  buildChildTaskBefore,
  buildRootTaskBefore,
  buildRootTaskToGroupEnd,
  getChangedTasks,
  getRealtimeActivityEvent,
} from "@/lib/activity-event-operations";
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
import { primeKeyboard } from "@/lib/ios-keyboard";
import { usePullToRefresh, PULL_TRIGGER_THRESHOLD } from "@/hooks/usePullToRefresh";
import { useLanguage } from "@/i18n/LanguageProvider";
import { createSampleHabits } from "@/lib/sample-habits";
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
import { ANONYMOUS_USER_ID, LEGACY_LOCAL_USER_ID } from "@/repositories/task-repository";
import type { ActivityEntityId, ActivityEntityType, ActivityEvent, ActivityEventType } from "@/types/activity";
import type { Habit, HabitColor, HabitEntry, HabitEntryId, HabitId, HabitUnitType } from "@/types/habit";
import type { Task, TaskGroup, TaskGroupId, TaskId, TaskNode, UserId } from "@/types/task";
import { AccountMenu } from "./AccountMenu";
import { CalendarTabView } from "./CalendarTabView";
import { DatePickerView } from "./DatePickerView";
import { DraggableBottomSheet } from "./DraggableBottomSheet";
import { GroupBar, type GroupBarSyncHandle } from "./GroupBar";
import { GroupSwipePager, type GroupSwipePagerHandle } from "./GroupSwipePager";
import { TrashDropZone, TRASH_DROPPABLE_ID } from "./TrashDropZone";
import { GroupEditorSheet } from "./GroupEditorSheet";
import { GroupManagerSheet } from "./GroupManagerSheet";
import { HabitEditorSheet } from "./HabitEditorSheet";
import { HabitTabView } from "./HabitTabView";
import { MindMapView } from "./MindMapView";
import {
  FloatingAddButton,
  QuickAddSheet,
  type QuickAddDraft,
} from "./QuickAddSheet";
import { InboxComposeBar } from "./InboxComposeBar";
import { InboxComposeRow } from "./InboxComposeRow";
import { InboxComposeScrim } from "./InboxComposeScrim";
import { PriorityEditorSheet } from "./PriorityEditorSheet";
import { ScheduleEditorSheet } from "./ScheduleEditorSheet";
import { TaskDetailView } from "./TaskDetailView";
import { TaskListView } from "./TaskListView";
import { ThemeToggle } from "./ThemeToggle";

const EMPTY_INBOX_DRAFT: QuickAddDraft = {
  title: "",
  dueDate: null,
  dueTime: null,
  priority: "none",
};

type LocalWorkspaceData = {
  groups: TaskGroup[];
  tasks: Task[];
  habits: Habit[];
  habitEntries: HabitEntry[];
  activityEvents: ActivityEvent[];
};

export function TaskApp() {
  const { language, messages: text } = useLanguage();
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
  const [loadedWorkspaceId, setLoadedWorkspaceId] = useState<UserId | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [hasLoadedTheme, setHasLoadedTheme] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>("inbox");
  const [selectedTaskId, setSelectedTaskId] = useState<TaskId | null>(null);
  const [isDetailComposerOpen, setIsDetailComposerOpen] = useState(false);
  const [datePickerTaskId, setDatePickerTaskId] = useState<TaskId | null>(null);
  const [mindMapRootId, setMindMapRootId] = useState<TaskId | null>(null);
  const [detailReturnTarget, setDetailReturnTarget] = useState<"list" | "mindmap">("list");
  const [autoEditTaskId, setAutoEditTaskId] = useState<TaskId | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddInitialDate, setQuickAddInitialDate] = useState<string | null>(null);
  // Inbox inline compose: non-null while a new task is being typed in the ghost
  // row at the top of the list. The slim bottom bar edits the same draft.
  const [inboxCompose, setInboxCompose] = useState<QuickAddDraft | null>(null);
  const [composeScheduleOpen, setComposeScheduleOpen] = useState(false);
  const [composePriorityOpen, setComposePriorityOpen] = useState(false);
  const inboxComposeInputRef = useRef<HTMLInputElement | null>(null);
  // True while a date/priority editor is open, so the ghost input's blur does
  // not commit/discard the draft while the user is picking a value.
  const suppressComposeCommitRef = useRef(false);
  // Guards against a double commit when a single tap on the scrim both blurs the
  // ghost input (onBlur -> finish) and clicks the scrim (onClick -> finish).
  const finishingComposeRef = useRef(false);
  const [calendarFocusedDate, setCalendarFocusedDate] = useState<string | null>(() => getTodayKey());
  const [groupEditorMode, setGroupEditorMode] = useState<"create" | "manage" | null>(null);
  const [habitEditorMode, setHabitEditorMode] = useState<"create" | "edit" | null>(null);
  const [editingHabitId, setEditingHabitId] = useState<HabitId | null>(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState<TaskId | null>(null);
  const [isOverTrash, setIsOverTrash] = useState(false);
  const pagerRef = useRef<GroupSwipePagerHandle>(null);
  const groupBarRef = useRef<GroupBarSyncHandle>(null);
  const [activeDragTaskId, setActiveDragTaskId] = useState<TaskId | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isAuthLoaded, setIsAuthLoaded] = useState(false);
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
  const pendingActivityWritesRef = useRef<Promise<void>[]>([]);
  const resetAnonymousOnNextLoadRef = useRef(false);
  const appScrollRef = useRef<HTMLDivElement>(null);
  const handlePullRefresh = useCallback(() => window.location.reload(), []);
  const { pull: pullDistance, refreshing: isRefreshing } = usePullToRefresh(
    appScrollRef,
    handlePullRefresh,
  );
  const sensors = useSensors(
    // Desktop: mouse is unaffected by touch-action, so behaviour is unchanged.
    useSensor(MouseSensor, {
      activationConstraint: {
        delay: 180,
        tolerance: 8,
      },
    }),
    // Touch: TouchSensor listens to touch events non-passively and preventDefaults
    // scrolling once the press-and-hold drag activates, so a vertical reorder drag
    // isn't hijacked by the browser's pan-y scroll (which cancelled PointerSensor).
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 180,
        tolerance: 8,
      },
    }),
  );

  // When inline compose opens, focus the ghost row's input once it mounts
  // (the keyboard was already primed on the opening tap) and bring the top of
  // the list into view so the ghost row — where the task lands — is visible.
  const isInboxComposing = inboxCompose !== null;
  useEffect(() => {
    if (!isInboxComposing) return;
    let frame = 0;
    let tries = 0;
    const focusGhost = () => {
      const input = inboxComposeInputRef.current;
      if (input) {
        input.focus({ preventScroll: true });
        appScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (tries > 30) return;
      tries += 1;
      frame = window.requestAnimationFrame(focusGhost);
    };
    frame = window.requestAnimationFrame(focusGhost);
    return () => window.cancelAnimationFrame(frame);
  }, [isInboxComposing]);

  // Custom collision detection: the trash drop zone should only win when the
  // pointer is actually over it (pointerWithin). Otherwise the built-in
  // closestCenter would snap a task into the trash whenever the current group
  // has no task droppables nearby (e.g. an empty group), making it look like
  // the delete button "sucks in" the task. All other droppables keep using
  // closestCenter for smooth reordering.
  const collisionDetection = useCallback<typeof closestCenter>((args) => {
    const pointerCollisions = pointerWithin(args);
    const trashCollision = pointerCollisions.find((c) => c.id === TRASH_DROPPABLE_ID);
    if (trashCollision) return [trashCollision];

    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (c) => c.id !== TRASH_DROPPABLE_ID,
      ),
    });
  }, []);
  const workspaceId = authUser ? getAuthenticatedWorkspaceId(authUser.id) : ANONYMOUS_USER_ID;

  const roots = useMemo(() => buildTaskTree(tasks), [tasks]);
  const allNodes = useMemo(() => flattenTaskTree(roots), [roots]);
  const taskCountByGroup = useMemo(() => {
    const counts: Record<TaskGroupId, number> = {};
    for (const task of tasks) {
      counts[task.groupId] = (counts[task.groupId] ?? 0) + 1;
    }
    return counts;
  }, [tasks]);
  const orderedGroups = useMemo(() => groups.slice().sort(sortGroupsByOrder), [groups]);
  const rootsByGroup = useMemo(() => {
    const map = new Map<TaskGroupId, TaskNode[]>();
    for (const root of roots) {
      const list = map.get(root.groupId);
      if (list) list.push(root);
      else map.set(root.groupId, [root]);
    }
    return map;
  }, [roots]);
  const selectedTask = selectedTaskId
    ? allNodes.find((node) => node.id === selectedTaskId) ?? null
    : null;
  useEffect(() => {
    // Reset the docked subtask composer whenever the open task changes/closes.
    setIsDetailComposerOpen(false);
  }, [selectedTaskId]);
  const datePickerTask = datePickerTaskId
    ? allNodes.find((node) => node.id === datePickerTaskId) ?? null
    : null;
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

  async function listWorkspaceLocalData(currentWorkspaceId: UserId): Promise<LocalWorkspaceData> {
    const storedTasks = await repository.listTasks(currentWorkspaceId);
    const storedHabits = await habitRepository.listHabits(currentWorkspaceId);
    const storedHabitEntries = await habitRepository.listHabitEntries(currentWorkspaceId);
    const storedActivityEvents = await activityRepository.listEvents(currentWorkspaceId);

    if (
      currentWorkspaceId === ANONYMOUS_USER_ID &&
      storedTasks.length === 0 &&
      storedHabits.length === 0 &&
      storedHabitEntries.length === 0
    ) {
      const [legacyTasks, legacyGroups, legacyHabits, legacyHabitEntries, legacyActivityEvents] =
        await Promise.all([
          repository.listTasks(LEGACY_LOCAL_USER_ID),
          groupRepository.listGroups(LEGACY_LOCAL_USER_ID),
          habitRepository.listHabits(LEGACY_LOCAL_USER_ID),
          habitRepository.listHabitEntries(LEGACY_LOCAL_USER_ID),
          activityRepository.listEvents(LEGACY_LOCAL_USER_ID),
        ]);

      if (legacyTasks.length > 0 || legacyHabits.length > 0 || legacyHabitEntries.length > 0) {
        return reassignLocalWorkspaceData(
          {
            groups: legacyGroups,
            tasks: legacyTasks,
            habits: legacyHabits,
            habitEntries: legacyHabitEntries,
            activityEvents: legacyActivityEvents,
          },
          ANONYMOUS_USER_ID,
        );
      }
    }

    return {
      groups: await groupRepository.listGroups(currentWorkspaceId),
      tasks: storedTasks,
      habits: storedHabits,
      habitEntries: storedHabitEntries,
      activityEvents: storedActivityEvents,
    };
  }

  useEffect(() => {
    if (!isAuthLoaded) return;

    let isActive = true;

    async function loadWorkspace() {
      setIsLoaded(false);
      setLoadedWorkspaceId(null);
      setTasks([]);
      setGroups([]);
      setHabits([]);
      setHabitEntries([]);
      lastSyncedFingerprintRef.current = null;
      setSelectedTaskId(null);
      setDatePickerTaskId(null);
      setMindMapRootId(null);
      setDetailReturnTarget("list");

      const shouldResetAnonymous =
        workspaceId === ANONYMOUS_USER_ID && resetAnonymousOnNextLoadRef.current;
      if (shouldResetAnonymous) {
        resetAnonymousOnNextLoadRef.current = false;
      }

      const storedLocalData = shouldResetAnonymous
        ? {
            groups: createDefaultGroups(workspaceId),
            tasks: [],
            habits: [],
            habitEntries: [],
            activityEvents: [],
          }
        : await listWorkspaceLocalData(workspaceId);
      const pendingSyncItems = shouldResetAnonymous
        ? []
        : await syncQueueRepository.listPendingItems(workspaceId);
      const shouldMergeLocalPending = pendingSyncItems.length > 0;

      let nextGroups = storedLocalData.groups.length > 0
        ? storedLocalData.groups
        : createDefaultGroups(workspaceId);
      let nextTasksBeforeDateRollover =
        storedLocalData.tasks.length > 0 ? storedLocalData.tasks : createSampleTasks(workspaceId, language);
      let nextHabits = storedLocalData.habits.length > 0
        ? storedLocalData.habits
        : createSampleHabits(workspaceId, language);
      let nextHabitEntries = storedLocalData.habitEntries;
      let nextActivityEvents = storedLocalData.activityEvents;

      if (authUser && supabase) {
        try {
          const cloudSnapshot = await pullSupabaseSnapshot(supabase, authUser.id, workspaceId);
          const hasCloudData = hasExistingCloudWorkspace(cloudSnapshot);

          if (hasCloudData && shouldMergeLocalPending) {
            const mergedSnapshot = mergeSyncSnapshots({
              local: {
                groups: nextGroups,
                tasks: nextTasksBeforeDateRollover,
                habits: nextHabits,
                habitEntries: nextHabitEntries,
                activityEvents: nextActivityEvents,
              },
              remote: cloudSnapshot,
            });

            nextGroups = mergedSnapshot.groups;
            nextTasksBeforeDateRollover = mergedSnapshot.tasks;
            nextHabits = mergedSnapshot.habits;
            nextHabitEntries = mergedSnapshot.habitEntries;
            nextActivityEvents = mergedSnapshot.activityEvents;
          } else if (hasCloudData) {
            nextGroups = cloudSnapshot.groups;
            nextTasksBeforeDateRollover = cloudSnapshot.tasks;
            nextHabits = cloudSnapshot.habits;
            nextHabitEntries = cloudSnapshot.habitEntries;
            nextActivityEvents = cloudSnapshot.activityEvents;
          } else if (!hasLocalWorkspaceContent(storedLocalData)) {
            const anonymousLocalData = await listWorkspaceLocalData(ANONYMOUS_USER_ID);

            if (hasLocalWorkspaceContent(anonymousLocalData)) {
              const inheritedLocalData = reassignLocalWorkspaceData(anonymousLocalData, workspaceId);
              nextGroups = inheritedLocalData.groups;
              nextTasksBeforeDateRollover = inheritedLocalData.tasks;
              nextHabits = inheritedLocalData.habits;
              nextHabitEntries = inheritedLocalData.habitEntries;
              nextActivityEvents = inheritedLocalData.activityEvents;
            }
          }
        } catch (error) {
          const message = getSyncErrorMessage(error);
          console.error("Initial cloud pull failed", error);
          setSyncStatus(`Cloud sync failed: ${message}`);
        }
      }

      const nextTasks = rolloverIncompletePastTasks(nextTasksBeforeDateRollover);

      if (!isActive) return;

      setTasks(nextTasks);
      setGroups(nextGroups);
      setHabits(nextHabits);
      setHabitEntries(nextHabitEntries);
      setActiveGroupId(nextGroups[0]?.id ?? DEFAULT_MY_TASKS_GROUP_ID);
      setLoadedWorkspaceId(workspaceId);
      setIsLoaded(true);

      await Promise.all([
        repository.saveTasks(workspaceId, nextTasks),
        groupRepository.saveGroups(workspaceId, nextGroups),
        habitRepository.saveHabits(workspaceId, nextHabits),
        habitRepository.saveHabitEntries(workspaceId, nextHabitEntries),
        activityRepository.saveEvents(workspaceId, nextActivityEvents),
      ]);
    }

    void loadWorkspace();

    return () => {
      isActive = false;
    };
  }, [
    activityRepository,
    authUser,
    groupRepository,
    habitRepository,
    isAuthLoaded,
    language,
    repository,
    supabase,
    syncQueueRepository,
    workspaceId,
  ]);

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
    if (!supabase) {
      setIsAuthLoaded(true);
      return;
    }
    const client = supabase;

    let isActive = true;

    async function loadSession() {
      const { data } = await client.auth.getSession();
      if (isActive) {
        setAuthUser(data.session?.user ?? null);
        setIsAuthLoaded(true);
      }
    }

    void loadSession();

    const { data: subscription } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        resetAnonymousOnNextLoadRef.current = true;
      }
      setAuthUser(session?.user ?? null);
      setIsAuthLoaded(true);
      lastSyncedFingerprintRef.current = null;
      setSyncStatus(session?.user ? "Cloud sync ready" : null);
    });

    return () => {
      isActive = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!isLoaded || loadedWorkspaceId !== workspaceId) return;
    void repository.saveTasks(workspaceId, tasks);
  }, [isLoaded, loadedWorkspaceId, repository, tasks, workspaceId]);

  useEffect(() => {
    if (!isLoaded || loadedWorkspaceId !== workspaceId) return;
    void groupRepository.saveGroups(workspaceId, groups);
  }, [groupRepository, groups, isLoaded, loadedWorkspaceId, workspaceId]);

  useEffect(() => {
    if (!isLoaded || loadedWorkspaceId !== workspaceId) return;
    void habitRepository.saveHabits(workspaceId, habits);
  }, [habitRepository, habits, isLoaded, loadedWorkspaceId, workspaceId]);

  useEffect(() => {
    if (!isLoaded || loadedWorkspaceId !== workspaceId) return;
    void habitRepository.saveHabitEntries(workspaceId, habitEntries);
  }, [habitEntries, habitRepository, isLoaded, loadedWorkspaceId, workspaceId]);

  useEffect(() => {
    if (groups.length === 0) return;
    if (groups.some((group) => group.id === activeGroupId)) return;
    setActiveGroupId(groups[0]?.id ?? DEFAULT_MY_TASKS_GROUP_ID);
  }, [activeGroupId, groups]);

  useEffect(() => {
    if (!isLoaded || loadedWorkspaceId !== workspaceId || !authUser || !supabase) return;

    const fingerprint = buildSyncFingerprint(groups, tasks, habits, habitEntries);
    if (fingerprint === lastSyncedFingerprintRef.current) return;

    const timeoutId = window.setTimeout(() => {
      void syncLocalDataToCloud(fingerprint);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [authUser, groups, habitEntries, habits, isLoaded, loadedWorkspaceId, supabase, tasks, workspaceId]);

  useEffect(() => {
    if (!isLoaded || loadedWorkspaceId !== workspaceId || !authUser || !supabase) return;

    const channel = supabase
      .channel(`activity-events:${authUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_events",
          filter: `user_id=eq.${authUser.id}`,
        },
        (payload) => {
          const activityEvent = getRealtimeActivityEvent(payload, workspaceId);
          if (!activityEvent || activityEvent.clientId === getClientId()) return;

          void activityRepository.addEvent(activityEvent);
          applyRemoteActivityEvent(activityEvent);
          setSyncStatus("Updated from another device");
        },
      )
      .subscribe((status, error) => {
        console.log("Realtime status", status, error);
      });

    function handleVisible() {
      if (document.visibilityState !== "visible") return;
      void syncRemoteActivityEventsFromCloud();
    }

    function handleFocus() {
      void syncRemoteActivityEventsFromCloud();
    }

    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("focus", handleFocus);
      void supabase.removeChannel(channel);
    };
  }, [authUser, isLoaded, loadedWorkspaceId, supabase, workspaceId]);

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
      if (pendingActivityWritesRef.current.length > 0) {
        await Promise.allSettled(pendingActivityWritesRef.current);
      }
      const [activityEvents, pendingSyncItems] = await Promise.all([
        activityRepository.listEvents(workspaceId),
        syncQueueRepository.listPendingItems(workspaceId),
      ]);

      const syncedQueueItemIds = await pushLocalSnapshotToSupabase(supabase, authUser.id, {
        groups,
        tasks,
        habits,
        habitEntries,
        activityEvents,
        pendingSyncItems,
      });

      await syncQueueRepository.markItemsSynced(workspaceId, syncedQueueItemIds);
      lastSyncedFingerprintRef.current = fingerprint;
      setSyncStatus("Synced with cloud");
    } catch (error) {
      const message = getSyncErrorMessage(error);
      console.error("Cloud sync failed", error);
      setSyncStatus(`Cloud sync failed: ${message}`);
    }
  }

  async function syncRemoteActivityEventsFromCloud() {
    if (!authUser || !supabase) return;

    try {
      setSyncStatus("Checking cloud changes...");
      const [localEvents, pulledSnapshot] = await Promise.all([
        activityRepository.listEvents(workspaceId),
        pullSupabaseSnapshot(supabase, authUser.id, workspaceId),
      ]);
      const localEventIds = new Set(localEvents.map((event) => event.id));
      const remoteEvents = pulledSnapshot.activityEvents.filter(
        (event) => !localEventIds.has(event.id) && event.clientId !== getClientId(),
      );

      for (const event of remoteEvents) {
        await activityRepository.addEvent(event);
        applyRemoteActivityEvent(event);
      }

      setSyncStatus(remoteEvents.length > 0 ? "Updated from cloud" : "Synced with cloud");
    } catch (error) {
      const message = getSyncErrorMessage(error);
      console.error("Cloud event catch-up failed", error);
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
      userId: workspaceId,
      type,
      entityType,
      entityId,
      clientId,
      payload,
      createdAt: now,
    };

    const writePromise = Promise.all([
      activityRepository.addEvent(event),
      syncQueueRepository.enqueueItem({
        id: crypto.randomUUID(),
        userId: workspaceId,
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
      }),
    ])
      .then(() => undefined)
      .finally(() => {
        pendingActivityWritesRef.current = pendingActivityWritesRef.current.filter(
          (pendingWrite) => pendingWrite !== writePromise,
        );
      });

    pendingActivityWritesRef.current.push(writePromise);
  }

  function applyRemoteActivityEvent(event: ActivityEvent) {
    if (event.entityType === "task") {
      setTasks((currentTasks) => applyTaskActivityEvent(currentTasks, event));
      return;
    }

    if (event.entityType === "task_group") {
      setGroups((currentGroups) => applyGroupActivityEvent(currentGroups, event));
      if (event.type === "group_deleted") {
        setTasks((currentTasks) => currentTasks.filter((task) => task.groupId !== event.entityId));
      }
      return;
    }

    if (event.entityType === "habit") {
      setHabits((currentHabits) => applyHabitActivityEvent(currentHabits, event));
      if (event.type === "habit_deleted") {
        setHabitEntries((currentEntries) =>
          currentEntries.filter((entry) => entry.habitId !== event.entityId),
        );
      }
      return;
    }

    if (event.entityType === "habit_entry") {
      setHabitEntries((currentEntries) => applyHabitEntryActivityEvent(currentEntries, event));
    }
  }

  function startInboxCompose() {
    // Raise the keyboard synchronously inside the tap (iOS), then mount the
    // ghost row; the focus effect below transfers focus to its input.
    primeKeyboard();
    finishingComposeRef.current = false;
    setInboxCompose({ ...EMPTY_INBOX_DRAFT });
  }

  function updateInboxComposeTitle(title: string) {
    setInboxCompose((current) => (current ? { ...current, title } : current));
  }

  // Enter: commit the current title and keep composing with a fresh ghost row,
  // holding the keyboard up for rapid entry. Empty input is ignored.
  function commitInboxComposeAndContinue() {
    const draft = inboxCompose;
    if (!draft || draft.title.trim().length === 0) return;
    addRootTask({ ...draft, title: draft.title.trim() }, true, { skipScrollIntoView: true });
    setInboxCompose({ ...EMPTY_INBOX_DRAFT });
    window.requestAnimationFrame(() => {
      inboxComposeInputRef.current?.focus({ preventScroll: true });
    });
  }

  // Blur (keyboard dismissed): save if there's any text, otherwise silently
  // discard, then close the composer. Skipped while a date/priority editor is
  // open so picking a value does not accidentally commit or cancel.
  function finishInboxCompose() {
    if (suppressComposeCommitRef.current) return;
    if (finishingComposeRef.current) return;
    const draft = inboxCompose;
    if (!draft) return;
    finishingComposeRef.current = true;
    setInboxCompose(null);
    if (draft.title.trim().length > 0) {
      addRootTask({ ...draft, title: draft.title.trim() }, true, { skipScrollIntoView: true });
    }
  }

  function openComposeSchedule() {
    suppressComposeCommitRef.current = true;
    setComposeScheduleOpen(true);
  }

  function openComposePriority() {
    suppressComposeCommitRef.current = true;
    setComposePriorityOpen(true);
  }

  function closeComposeEditors() {
    setComposeScheduleOpen(false);
    setComposePriorityOpen(false);
    suppressComposeCommitRef.current = false;
    // Return focus to the ghost input to keep composing. Focus synchronously
    // inside the dismiss gesture (best chance iOS re-opens the keyboard), then
    // again after the editor unmounts.
    inboxComposeInputRef.current?.focus({ preventScroll: true });
    window.requestAnimationFrame(() => {
      inboxComposeInputRef.current?.focus({ preventScroll: true });
    });
  }

  function handleAddTask(draft?: QuickAddDraft) {
    if (draft) {
      if (activeTab === "calendar" || activeTab === "inbox") {
        // Compose mode: add immediately and keep the sheet open for the next task.
        addRootTask(draft, true);
        return;
      }
      setIsQuickAddOpen(false);
      window.setTimeout(() => addRootTask(draft, true), QUICK_ADD_REFLECT_DELAY_MS);
      return;
    }

    addRootTask(undefined, false);
    setIsQuickAddOpen(false);
  }

  function addRootTask(
    draft: QuickAddDraft | undefined,
    hasDraft: boolean,
    options: { skipScrollIntoView?: boolean } = {},
  ) {
    const taskId = crypto.randomUUID();
    const now = new Date().toISOString();
    const rootOrdersInGroup = tasks
      .filter((task) => task.parentId === null && task.groupId === activeGroupId)
      .map((task) => task.order);
    const topOrder = rootOrdersInGroup.length > 0 ? Math.min(...rootOrdersInGroup) - 1 : 0;
    const nextTasks = addTask(tasks, {
      userId: workspaceId,
      title: draft?.title ?? text.newTask,
      parentId: null,
      groupId: activeGroupId,
      order: topOrder,
      dueDate: draft?.dueDate ?? null,
      dueTime: draft?.dueTime ?? null,
      priority: draft?.priority ?? "none",
    }, {
      generateId: () => taskId,
      now: () => now,
    });
    const createdTask = nextTasks.find((task) => task.id === taskId) ?? null;

    setTasks(nextTasks);
    setHighlightedTaskId(taskId);
    window.setTimeout(() => {
      setHighlightedTaskId((currentTaskId) => (currentTaskId === taskId ? null : currentTaskId));
    }, 1400);

    if (activeTab !== "calendar" && !options.skipScrollIntoView) {
      // Show the user exactly where the task landed: once React has committed
      // the new row, bring it into view in the app scroller. The calendar tab
      // handles this itself by re-pinning the composed day above the sheet.
      // Skipped during inline compose, which keeps the ghost row pinned at top.
      window.setTimeout(() => {
        document
          .querySelector(`[data-task-id="${taskId}"]`)
          ?.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 80);
    }

    if (!draft) {
      setAutoEditTaskId(taskId);
    }

    recordActivity("task_created", "task", taskId, {
      task: createdTask,
      groupId: activeGroupId,
      hasDraft,
    });
  }

  function handleAddChild(parentId: TaskId, draft?: QuickAddDraft) {
    const taskId = crypto.randomUUID();
    const title = draft?.title ?? text.newTask;
    const now = new Date().toISOString();
    const nextTasks = addTask(tasks, {
      userId: workspaceId,
      title,
      parentId,
      dueDate: draft?.dueDate ?? null,
      dueTime: draft?.dueTime ?? null,
      priority: draft?.priority ?? "none",
    }, {
      generateId: () => taskId,
      now: () => now,
    });
    const syncedTasks = syncAncestorCompletion(nextTasks, taskId, { now: () => now });
    const createdTask = syncedTasks.find((task) => task.id === taskId) ?? null;

    setTasks(syncedTasks);
    if (!draft) {
      setAutoEditTaskId(taskId);
    }
    recordActivity("task_created", "task", taskId, { task: createdTask, parentId });
  }

  function handleReorderChild(activeId: TaskId, overId: TaskId) {
    if (activeId === overId) return;
    const nextTasks = buildChildTaskBefore(tasks, activeId, overId);
    if (nextTasks === tasks) return;

    setTasks(nextTasks);
    recordActivity("task_moved", "task", activeId, {
      tasks: getChangedTasks(tasks, nextTasks),
      beforeTaskId: overId,
      fields: ["order"],
    });
  }

  function handleAddGroup(name: string) {
    const now = new Date().toISOString();
    const group = createGroup(
      crypto.randomUUID(),
      workspaceId,
      name,
      groups.length,
      now,
    );

    setGroups((currentGroups) => [...currentGroups, group]);
    setActiveGroupId(group.id);
    setGroupEditorMode(null);
    recordActivity("group_created", "task_group", group.id, { group });
  }

  function handleRenameGroupById(groupId: TaskGroupId, name: string) {
    const target = groups.find((group) => group.id === groupId);
    if (!target || target.name === name) return;
    const now = new Date().toISOString();

    setGroups((currentGroups) =>
      currentGroups.map((group) =>
        group.id === groupId
          ? { ...group, name, updatedAt: now }
          : group,
      ),
    );
    recordActivity("group_updated", "task_group", groupId, {
      patch: {
        name,
        updatedAt: now,
      },
      fields: ["name"],
    });
  }

  function handleReorderGroups(orderedGroupIds: TaskGroupId[]) {
    const now = new Date().toISOString();
    const reorderedGroups: TaskGroup[] = [];

    orderedGroupIds.forEach((groupId, index) => {
      const group = groups.find((currentGroup) => currentGroup.id === groupId);
      if (!group) return;
      reorderedGroups.push(group.order === index ? group : { ...group, order: index, updatedAt: now });
    });

    const nextGroupsById = new Map<TaskGroupId, TaskGroup>(
      reorderedGroups.map((group) => [group.id, group]),
    );
    const changedGroups = reorderedGroups.filter((group) => {
      const previousGroup = groups.find((currentGroup) => currentGroup.id === group.id);
      return previousGroup?.order !== group.order;
    });

    if (changedGroups.length === 0) return;

    setGroups((currentGroups) =>
      currentGroups.map((group) => nextGroupsById.get(group.id) ?? group),
    );
    changedGroups.forEach((group) => {
      recordActivity("group_updated", "task_group", group.id, {
        patch: {
          order: group.order,
          updatedAt: group.updatedAt,
        },
        fields: ["order"],
      });
    });
  }

  function handleDeleteGroupById(deletedGroupId: TaskGroupId) {
    if (deletedGroupId === DEFAULT_MY_TASKS_GROUP_ID) return;

    const nextActiveGroup = groups.find((group) => group.id !== deletedGroupId);
    const deletedTaskIds = tasks
      .filter((task) => task.groupId === deletedGroupId)
      .map((task) => task.id);

    setGroups((currentGroups) =>
      currentGroups
        .filter((group) => group.id !== deletedGroupId)
        .map((group, index) => ({ ...group, order: index })),
    );
    setTasks((currentTasks) =>
      currentTasks.filter((task) => task.groupId !== deletedGroupId),
    );
    // Keep the manage sheet open; only move off the deleted group if it was active.
    setActiveGroupId((currentActiveId) =>
      currentActiveId === deletedGroupId
        ? nextActiveGroup?.id ?? DEFAULT_MY_TASKS_GROUP_ID
        : currentActiveId,
    );
    recordActivity("group_deleted", "task_group", deletedGroupId);
    deletedTaskIds.forEach((deletedTaskId) => {
      recordActivity("task_deleted", "task", deletedTaskId, { groupId: deletedGroupId });
    });
  }

  function handleToggleComplete(taskId: TaskId) {
    const task = allNodes.find((node) => node.id === taskId);
    const now = new Date().toISOString();
    const completed = !task?.completed;
    setTasks((currentTasks) =>
      toggleTaskAndSyncAncestors(currentTasks, taskId, { now: () => now }),
    );
    recordActivity(
      task?.completed ? "task_uncompleted" : "task_completed",
      "task",
      taskId,
      {
        patch: {
          completed,
          completedAt: completed ? now : null,
          updatedAt: now,
        },
        fields: ["completed", "completedAt"],
      },
    );
  }

  function handleRenameTask(taskId: TaskId, title: string) {
    const now = new Date().toISOString();
    setTasks((currentTasks) => renameTask(currentTasks, taskId, title, { now: () => now }));
    recordActivity("task_updated", "task", taskId, {
      patch: {
        title: title.trim(),
        updatedAt: now,
      },
      field: "title",
      fields: ["title"],
    });
  }

  function handleUpdateDescription(taskId: TaskId, description: string) {
    const now = new Date().toISOString();
    setTasks((currentTasks) =>
      updateTaskDescription(currentTasks, taskId, description, { now: () => now }),
    );
    recordActivity("task_updated", "task", taskId, {
      patch: {
        description,
        updatedAt: now,
      },
      field: "description",
      fields: ["description"],
    });
  }

  function handleUpdatePriority(taskId: TaskId, priority: Task["priority"]) {
    const now = new Date().toISOString();
    setTasks((currentTasks) =>
      updateTaskPriority(currentTasks, taskId, priority, { now: () => now }),
    );
    recordActivity("task_priority_changed", "task", taskId, {
      patch: {
        priority,
        updatedAt: now,
      },
      priority,
      fields: ["priority"],
    });
  }

  function handleSaveSchedule(
    taskId: TaskId,
    dueDate: string | null,
    dueTime: string | null,
  ) {
    const now = new Date().toISOString();
    setTasks((currentTasks) =>
      updateTaskSchedule(currentTasks, taskId, dueDate, dueTime, { now: () => now }),
    );
    setDatePickerTaskId(null);
    recordActivity("task_scheduled", "task", taskId, {
      patch: {
        dueDate,
        dueTime,
        updatedAt: now,
      },
      dueDate,
      dueTime,
      fields: ["dueDate", "dueTime"],
    });
  }

  function handleMoveTaskToDate(taskId: TaskId, dueDate: string) {
    const task = allNodes.find((node) => node.id === taskId);
    if (!task || task.dueDate === dueDate) return;
    const now = new Date().toISOString();
    const dueTime = task.dueTime ?? null;
    setTasks((currentTasks) =>
      updateTaskSchedule(currentTasks, taskId, dueDate, dueTime, { now: () => now }),
    );
    recordActivity("task_scheduled", "task", taskId, {
      patch: {
        dueDate,
        dueTime,
        updatedAt: now,
      },
      dueDate,
      dueTime,
      fields: ["dueDate", "dueTime"],
    });
  }

  function handleDeleteTask(taskId: TaskId) {
    const deletedTask = allNodes.find((node) => node.id === taskId) ?? null;
    const deletedTaskIds = deletedTask ? collectTaskNodeIds(deletedTask) : [taskId];

    setTasks((currentTasks) => deleteTask(currentTasks, taskId));

    if (selectedTaskId && deletedTaskIds.includes(selectedTaskId)) {
      setSelectedTaskId(
        detailReturnTarget === "mindmap" ? null : deletedTask?.parentId ?? null,
      );
    }

    if (mindMapRootId && deletedTaskIds.includes(mindMapRootId)) {
      setMindMapRootId(null);
    }
    deletedTaskIds.forEach((deletedTaskId) => {
      recordActivity("task_deleted", "task", deletedTaskId, { rootTaskId: taskId });
    });
  }

  function handleAddHabit(
    title: string,
    unitType: HabitUnitType,
    unitMinutes: number,
    color: HabitColor,
  ) {
    const habitId = crypto.randomUUID();
    const now = new Date().toISOString();
    const nextHabits = addHabit(habits, {
      userId: workspaceId,
      title,
      unitType,
      unitMinutes,
      color,
    }, {
      generateId: () => habitId,
      now: () => now,
    });
    const habit = nextHabits.find((item) => item.id === habitId) ?? null;

    setHabits(nextHabits);
    setHabitEditorMode(null);
    recordActivity("habit_created", "habit", habitId, { habit });
  }

  function handleUpdateHabit(
    title: string,
    unitType: HabitUnitType,
    unitMinutes: number,
    color: HabitColor,
  ) {
    if (!editingHabit) return;
    const now = new Date().toISOString();

    if (editingHabit.unitType !== unitType || editingHabit.unitMinutes !== unitMinutes) {
      setHabitEntries((currentEntries) =>
        rebalanceHabitEntriesForUnit(currentEntries, editingHabit, unitType, unitMinutes, {
          now: () => now,
        }),
      );
    }

    setHabits((currentHabits) =>
      updateHabit(currentHabits, editingHabit.id, { title, unitType, unitMinutes, color }, {
        now: () => now,
      }),
    );
    setHabitEditorMode(null);
    setEditingHabitId(null);
    recordActivity("habit_updated", "habit", editingHabit.id, {
      patch: {
        title,
        unitType,
        unitMinutes: unitType === "times" ? 0 : Math.round(unitMinutes),
        color,
        updatedAt: now,
      },
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
    const now = new Date().toISOString();
    const nextEntries = addHabitEntry(habitEntries, habit, {
      generateId: () => entryId,
      now: () => now,
    });
    const entry = nextEntries.find((item) => item.id === entryId) ?? null;

    setHabitEntries(nextEntries);
    recordActivity("habit_checked", "habit_entry", entryId, { entry, habitId });
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

    const now = new Date().toISOString();
    const nextOrderedIds = arrayMove(orderedIds, oldIndex, newIndex);
    const nextHabits = reorderHabits(habits, nextOrderedIds, { now: () => now });

    setHabits(nextHabits);
    recordActivity("habit_reordered", "habit", activeId, {
      orderedHabitIds: nextOrderedIds,
      overId,
      fields: ["order"],
    });
  }

  function handleDragStart(event: DragStartEvent) {
    const activeId = String(event.active.id);

    const pointerX = getPointerClientX(event.activatorEvent);
    const pointerY = getPointerClientY(event.activatorEvent);

    setActiveDragTaskId(activeId);
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

  function handleDragOver(event: DragOverEvent) {
    setIsOverTrash(event.over?.id === TRASH_DROPPABLE_ID);
  }

  function handleDragEnd(event: DragEndEvent) {
    clearGroupHoverTimer();
    clearEdgeSwitchTimer();
    clearGroupChipsScrollTimer();
    stopPointerTracking();
    setActiveDragTaskId(null);
    setIsOverTrash(false);
    dragStartXRef.current = null;
    dragStartYRef.current = null;
    latestPointerRef.current = null;

    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;

    const draggedTask = allNodes.find((node) => node.id === activeId);
    if (!draggedTask || draggedTask.parentId !== null || draggedTask.completed) return;

    if (overId === TRASH_DROPPABLE_ID) {
      dragTargetGroupIdRef.current = null;
      if (draggedTask.children.length === 0 || window.confirm(text.taskDetail.deleteWithSubtasks)) {
        handleDeleteTask(activeId);
      }
      return;
    }

    if (!overId) {
      if (dragTargetGroupIdRef.current) {
        const nextTasks = moveRootTaskToGroupEnd(activeId, dragTargetGroupIdRef.current);
        recordActivity("task_moved", "task", activeId, {
          tasks: getChangedTasks(tasks, nextTasks),
          groupId: dragTargetGroupIdRef.current,
          fields: ["groupId", "parentId", "order"],
        });
      }
      dragTargetGroupIdRef.current = null;
      return;
    }

    const overTask = allNodes.find((node) => node.id === overId);
    if (!overTask || overTask.parentId !== null || overTask.completed) return;

    const nextTasks = moveRootTaskBefore(activeId, overTask.id, overTask.groupId);
    recordActivity("task_moved", "task", activeId, {
      tasks: getChangedTasks(tasks, nextTasks),
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
    setIsOverTrash(false);
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

  function moveRootTaskBefore(
    taskId: TaskId,
    overTaskId: TaskId,
    destinationGroupId: TaskGroupId,
  ): Task[] {
    const nextTasks = buildRootTaskBefore(tasks, taskId, overTaskId, destinationGroupId);
    setTasks(nextTasks);
    return nextTasks;
  }

  function moveRootTaskToGroupEnd(taskId: TaskId, destinationGroupId: TaskGroupId): Task[] {
    const nextTasks = buildRootTaskToGroupEnd(tasks, taskId, destinationGroupId);
    setTasks(nextTasks);
    return nextTasks;
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

    const nextGroupId = getAdjacentGroupId(orderedGroups, activeGroupId, direction);
    if (!nextGroupId) {
      clearEdgeSwitchTimer();
      return;
    }

    if (edgeSwitchDirectionRef.current === direction) return;

    clearEdgeSwitchTimer();
    edgeSwitchDirectionRef.current = direction;
    edgeSwitchTimerRef.current = window.setTimeout(() => {
      // Slide the pager to the neighbour with the same eased curve so the switch
      // is visible; the pager commits the new active group when it settles.
      const slid = pagerRef.current?.slideTo(direction === "previous" ? "prev" : "next");
      if (slid) {
        dragTargetGroupIdRef.current = nextGroupId;
      }
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

  function renderGroupList(groupId: TaskGroupId, isActive: boolean) {
    const groupRoots = rootsByGroup.get(groupId) ?? [];
    const isComposingHere = isActive && activeTab === "inbox" && inboxCompose !== null;
    if (groupRoots.length === 0 && !isComposingHere) {
      return (
        <div className="emptyState compactEmpty">
          <p>{text.emptyTasks}</p>
        </div>
      );
    }

    const activeRoots = groupRoots.filter((root) => !root.completed);
    const completedRoots = groupRoots
      .filter((root) => root.completed)
      .slice()
      .sort(sortCompletedTasks);

    return (
      <TaskListView
        roots={activeRoots}
        completedRoots={completedRoots}
        interactive={isActive}
        onSelectTask={openListDetail}
        onOpenMindMap={setMindMapRootId}
        onToggleComplete={handleToggleComplete}
        onRenameTask={handleRenameTask}
        autoEditTaskId={autoEditTaskId}
        onAutoEditConsumed={() => setAutoEditTaskId(null)}
        highlightedTaskId={highlightedTaskId}
        isSortingTask={isActive && activeDragTaskId !== null}
        composeSlot={
          isActive && activeTab === "inbox" && inboxCompose ? (
            <InboxComposeRow
              draft={inboxCompose}
              inputRef={inboxComposeInputRef}
              onChangeTitle={updateInboxComposeTitle}
              onSubmit={commitInboxComposeAndContinue}
              onFinish={finishInboxCompose}
            />
          ) : null
        }
      />
    );
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

  function openCalendarQuickAdd(dueDate: string) {
    primeKeyboard();
    setQuickAddInitialDate(dueDate);
    setIsQuickAddOpen(true);
  }

  return (
    <main className="appShell">
      <div
        className="ptrIndicator"
        data-refreshing={isRefreshing ? "true" : undefined}
        aria-hidden="true"
        style={{
          transform: `translate(-50%, ${pullDistance - 44}px)`,
          opacity: pullDistance > 4 || isRefreshing ? 1 : 0,
          // Follow the finger 1:1 while pulling; animate the snap-back on release.
          transition: pullDistance > 0 && !isRefreshing ? "opacity 160ms ease" : undefined,
        }}
      >
        <span
          className="ptrSpinner"
          style={
            isRefreshing
              ? undefined
              : { transform: `rotate(${(pullDistance / PULL_TRIGGER_THRESHOLD) * 270}deg)` }
          }
        >
          <RefreshCw size={20} aria-hidden="true" />
        </span>
      </div>
      <div className="appScroll" ref={appScrollRef}>
      <header className="appHeader">
        <div className="brand">
          <span className="brandMark" aria-hidden="true" />
          <h1>{text.appName}</h1>
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
        <div className="loadingState">{text.loading}</div>
      ) : activeTab === "calendar" ? (
        <CalendarTabView
          tasks={allNodes}
          onSelectTask={openCalendarDetail}
          focusedDate={calendarFocusedDate}
          onFocusDate={setCalendarFocusedDate}
          onAddTask={openCalendarQuickAdd}
          onMoveTask={handleMoveTaskToDate}
          onDeleteTask={handleDeleteTask}
          composeDate={isQuickAddOpen ? quickAddInitialDate : null}
          highlightedTaskId={highlightedTaskId}
        />
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
          collisionDetection={collisionDetection}
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <section className="workspace">
            <GroupBar
              ref={groupBarRef}
              groups={orderedGroups}
              activeGroupId={activeGroupId}
              onRegisterGroupChipsContainer={handleRegisterGroupChipsContainer}
              onRegisterGroupChip={handleRegisterGroupChip}
              onSelectGroup={setActiveGroupId}
              onAddGroup={() => setGroupEditorMode("create")}
              onOpenMenu={() => setGroupEditorMode("manage")}
              onReorderGroups={handleReorderGroups}
            />
            <GroupSwipePager
              ref={pagerRef}
              orderedGroups={orderedGroups}
              activeGroupId={activeGroupId}
              disabled={activeDragTaskId !== null}
              onChangeActiveGroup={setActiveGroupId}
              renderGroup={renderGroupList}
              onSwipeProgress={(fromId, toId, t, animate) =>
                groupBarRef.current?.setProgress(fromId, toId, t, animate)
              }
            />
          </section>
          <TrashDropZone active={activeDragTaskId !== null} />
          <DragOverlay modifiers={[snapCenterToCursor]}>
            {activeDragTask ? (
              <div className={isOverTrash ? "dragOverlayTask isOverTrash" : "dragOverlayTask"}>
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
      </div>
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
          initialOffset={isDetailComposerOpen ? 0 : 88}
          onDismiss={() => setSelectedTaskId(null)}
        >
          <TaskDetailView
            task={selectedTask}
            path={selectedPath}
            groupName={groups.find((group) => group.id === selectedTask.groupId)?.name ?? text.lists.area}
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
            onReorderChild={handleReorderChild}
            composerOpen={isDetailComposerOpen}
            onComposerOpenChange={setIsDetailComposerOpen}
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
      {showQuickAdd && activeTab !== "calendar" && !inboxCompose ? (
        <FloatingAddButton
          onClick={() => {
            if (activeTab === "habit") {
              setHabitEditorMode("create");
              return;
            }
            startInboxCompose();
          }}
        />
      ) : null}
      {inboxCompose ? (
        <InboxComposeScrim
          onScrollBy={(delta) => {
            if (appScrollRef.current) appScrollRef.current.scrollTop += delta;
          }}
          onDismiss={finishInboxCompose}
        />
      ) : null}
      {inboxCompose ? (
        <InboxComposeBar
          draft={inboxCompose}
          onOpenSchedule={openComposeSchedule}
          onOpenPriority={openComposePriority}
          onSuppressCommit={() => {
            suppressComposeCommitRef.current = true;
          }}
        />
      ) : null}
      {inboxCompose && composeScheduleOpen ? (
        <ScheduleEditorSheet
          dueDate={inboxCompose.dueDate}
          dueTime={inboxCompose.dueTime}
          onChange={(dueDate, dueTime) =>
            setInboxCompose((current) => (current ? { ...current, dueDate, dueTime } : current))
          }
          onDismiss={closeComposeEditors}
        />
      ) : null}
      {inboxCompose && composePriorityOpen ? (
        <PriorityEditorSheet
          value={inboxCompose.priority}
          onChange={(priority) =>
            setInboxCompose((current) => (current ? { ...current, priority } : current))
          }
          onDismiss={closeComposeEditors}
        />
      ) : null}
      <QuickAddSheet
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onSave={handleAddTask}
        initialDueDate={quickAddInitialDate}
        keepOpenOnSave={activeTab === "calendar"}
        transparentBackdrop={activeTab === "calendar" && quickAddInitialDate !== null}
      />
      {groupEditorMode === "create" ? (
        <GroupEditorSheet
          mode="create"
          onDismiss={() => setGroupEditorMode(null)}
          onSave={handleAddGroup}
        />
      ) : null}
      {groupEditorMode === "manage" ? (
        <GroupManagerSheet
          groups={groups}
          taskCountByGroup={taskCountByGroup}
          onRename={handleRenameGroupById}
          onDelete={handleDeleteGroupById}
          onDismiss={() => setGroupEditorMode(null)}
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
            {text.tabs.inbox}
          </button>
          <button
            className={activeTab === "calendar" ? "bottomTab isActive" : "bottomTab"}
            type="button"
            onClick={() => handleTabChange("calendar")}
          >
            {text.tabs.calendar}
          </button>
          <button
            className={activeTab === "habit" ? "bottomTab isActive" : "bottomTab"}
            type="button"
            onClick={() => handleTabChange("habit")}
          >
            {text.tabs.habit}
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

const THEME_STORAGE_KEY = "todoapp.theme";
const CLIENT_ID_STORAGE_KEY = "todoapp.client-id";
type AppTab = "inbox" | "calendar" | "habit";

const GROUP_HOVER_SWITCH_DELAY_MS = 600;
const EDGE_SWITCH_DELAY_MS = 650;
const EDGE_SWITCH_ZONE_PX = 28;
const GROUP_CHIPS_SCROLL_ZONE_PX = 34;
const GROUP_CHIPS_SCROLL_STEP_PX = 7;
const GROUP_CHIPS_SCROLL_INTERVAL_MS = 24;
const QUICK_ADD_REFLECT_DELAY_MS = 500;

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

function sortGroupsByOrder(first: TaskGroup, second: TaskGroup): number {
  return first.order - second.order || first.createdAt.localeCompare(second.createdAt);
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

function collectTaskNodeIds(task: TaskNode): TaskId[] {
  return [
    task.id,
    ...task.children.flatMap((child) => collectTaskNodeIds(child)),
  ];
}

function getAuthenticatedWorkspaceId(authUserId: string): UserId {
  return `auth:${authUserId}`;
}

function hasExistingCloudWorkspace(snapshot: {
  groups: TaskGroup[];
  tasks: Task[];
  habits: Habit[];
  habitEntries: HabitEntry[];
  activityEvents: unknown[];
}): boolean {
  return (
    snapshot.groups.length > 0 ||
    snapshot.tasks.length > 0 ||
    snapshot.habits.length > 0 ||
    snapshot.habitEntries.length > 0 ||
    snapshot.activityEvents.length > 0
  );
}

function hasLocalWorkspaceContent(data: LocalWorkspaceData): boolean {
  return (
    data.tasks.length > 0 ||
    data.habits.length > 0 ||
    data.habitEntries.length > 0 ||
    data.activityEvents.length > 0
  );
}

function reassignLocalWorkspaceData(data: LocalWorkspaceData, userId: UserId): LocalWorkspaceData {
  return {
    groups: data.groups.map((group) => ({ ...group, userId })),
    tasks: data.tasks.map((task) => ({ ...task, userId })),
    habits: data.habits.map((habit) => ({ ...habit, userId })),
    habitEntries: data.habitEntries.map((entry) => ({ ...entry, userId })),
    activityEvents: data.activityEvents.map((event) => ({ ...event, userId })),
  };
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
