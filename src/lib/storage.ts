/** Armazenamento chave-valor sobre IndexedDB, com fallback em memória (SSR, navegação privada, falhas). */
const DB_NAME = "shadow-realm";
const STORE = "kv";

const memory = new Map<string, unknown>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  dbPromise ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function run<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  if (!db) return memory.get(key) as T | undefined;
  try {
    return (await run(db, "readonly", (s) => s.get(key))) as T | undefined;
  } catch {
    return memory.get(key) as T | undefined;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  memory.set(key, value);
  if (!db) return;
  try {
    await run(db, "readwrite", (s) => s.put(value, key));
  } catch {
    /* mantém a cópia em memória */
  }
}

export async function kvClear(): Promise<void> {
  memory.clear();
  const db = await openDb();
  if (!db) return;
  try {
    await run(db, "readwrite", (s) => s.clear());
  } catch {
    /* ignora */
  }
}
