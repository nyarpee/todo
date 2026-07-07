import type { UserId } from "@/types/task";

const DB_NAME = "todoapp.local-first";
const DB_VERSION = 2;

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

    request.onupgradeneeded = (event) => {
      const database = request.result;
      const transaction = request.transaction;
      const oldVersion = event.oldVersion;

      for (const storeName of Object.values(INDEXED_DB_STORES)) {
        if (oldVersion > 0 && oldVersion < 2 && database.objectStoreNames.contains(storeName)) {
          migrateUserStoreToCompoundKey(database, transaction, storeName);
        } else {
          ensureUserStore(database, storeName);
        }
      }
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

  const store = database.createObjectStore(storeName, { keyPath: ["userId", "id"] });
  store.createIndex("userId", "userId", { unique: false });
  store.createIndex("updatedAt", "updatedAt", { unique: false });
  store.createIndex("createdAt", "createdAt", { unique: false });
}

function migrateUserStoreToCompoundKey(
  database: IDBDatabase,
  transaction: IDBTransaction | null,
  storeName: StoreName,
): void {
  if (!transaction) {
    database.deleteObjectStore(storeName);
    ensureUserStore(database, storeName);
    return;
  }

  const oldStore = transaction.objectStore(storeName);
  const getAllRequest = oldStore.getAll();

  getAllRequest.onsuccess = () => {
    const records = getAllRequest.result;
    database.deleteObjectStore(storeName);
    const newStore = database.createObjectStore(storeName, { keyPath: ["userId", "id"] });
    newStore.createIndex("userId", "userId", { unique: false });
    newStore.createIndex("updatedAt", "updatedAt", { unique: false });
    newStore.createIndex("createdAt", "createdAt", { unique: false });

    records.forEach((record) => {
      if (isUserRecord(record)) {
        newStore.put(record);
      }
    });
  };
}

function isUserRecord(value: unknown): value is { id: string; userId: UserId } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string" &&
    typeof (value as { userId?: unknown }).userId === "string"
  );
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
