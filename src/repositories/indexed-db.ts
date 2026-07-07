import type { UserId } from "@/types/task";

const DB_NAME = "todoapp.local-first";
const DB_VERSION = 1;

export const INDEXED_DB_STORES = {
  tasks: "tasks",
  taskGroups: "task_groups",
  habits: "habits",
  habitEntries: "habit_entries",
  activityEvents: "activity_events",
  syncQueue: "sync_queue",
} as const;

type StoreName = (typeof INDEXED_DB_STORES)[keyof typeof INDEXED_DB_STORES];

let databasePromise: Promise<IDBDatabase> | null = null;

export function openTodoDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      ensureUserStore(database, INDEXED_DB_STORES.tasks);
      ensureUserStore(database, INDEXED_DB_STORES.taskGroups);
      ensureUserStore(database, INDEXED_DB_STORES.habits);
      ensureUserStore(database, INDEXED_DB_STORES.habitEntries);
      ensureUserStore(database, INDEXED_DB_STORES.activityEvents);
      ensureUserStore(database, INDEXED_DB_STORES.syncQueue);
    };

    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
    request.onsuccess = () => resolve(request.result);
  });

  return databasePromise;
}

export async function listUserRecords<T extends { userId: UserId }>(
  storeName: StoreName,
  userId: UserId,
): Promise<T[]> {
  const database = await openTodoDatabase();
  const transaction = database.transaction(storeName, "readonly");
  const store = transaction.objectStore(storeName);
  const index = store.index("userId");
  const request = index.getAll(userId);
  return requestToPromise<T[]>(request);
}

export async function replaceUserRecords<T extends { id: string; userId: UserId }>(
  storeName: StoreName,
  userId: UserId,
  records: T[],
): Promise<void> {
  const database = await openTodoDatabase();
  const transaction = database.transaction(storeName, "readwrite");
  const store = transaction.objectStore(storeName);
  const index = store.index("userId");
  const cursorRequest = index.openCursor(userId);

  await new Promise<void>((resolve, reject) => {
    cursorRequest.onerror = () => reject(cursorRequest.error);
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) {
        resolve();
        return;
      }

      cursor.delete();
      cursor.continue();
    };
  });

  for (const record of records) {
    store.put(record);
  }

  await transactionDone(transaction);
}

export async function putRecord<T extends { id: string }>(
  storeName: StoreName,
  record: T,
): Promise<void> {
  const database = await openTodoDatabase();
  const transaction = database.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).put(record);
  await transactionDone(transaction);
}

function ensureUserStore(database: IDBDatabase, storeName: StoreName): void {
  if (database.objectStoreNames.contains(storeName)) return;

  const store = database.createObjectStore(storeName, { keyPath: "id" });
  store.createIndex("userId", "userId", { unique: false });
  store.createIndex("updatedAt", "updatedAt", { unique: false });
  store.createIndex("createdAt", "createdAt", { unique: false });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
