export interface LocalReplayRecord {
  id: string;
  created_at: string;
  payload: unknown;
}

const DATABASE = 'sailing-training-local-replays-v1';
const STORE = 'replays';

export type StorageFailureCode = 'STORAGE_READ_FAILED' | 'STORAGE_WRITE_FAILED';
export class LocalReplayStorageError extends Error {
  constructor(readonly code: StorageFailureCode) { super(code); this.name = 'LocalReplayStorageError'; }
}

/** Minimal driver seam: production uses IndexedDB; tests inject a scripted fake. */
export interface ReplayStorageDriver {
  list(): Promise<readonly LocalReplayRecord[]>;
  save(record: LocalReplayRecord): Promise<void>;
  delete(id: string): Promise<void>;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB unavailable.'));
  });
}

const indexedDbDriver: ReplayStorageDriver = {
async list(): Promise<readonly LocalReplayRecord[]> {
  const db = await database();
  try {
    const tx = db.transaction(STORE, 'readonly');
    const finished = transactionComplete(tx);
    const records = await requestResult(tx.objectStore(STORE).getAll()) as readonly LocalReplayRecord[];
    await finished;
    return records;
  } finally {
    db.close();
  }
},

async save(record: LocalReplayRecord): Promise<void> {
  const db = await database();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const finished = transactionComplete(tx);
    await requestResult(tx.objectStore(STORE).put(record));
    await finished;
  } finally {
    db.close();
  }
},

async delete(id: string): Promise<void> {
  const db = await database();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const finished = transactionComplete(tx);
    await requestResult(tx.objectStore(STORE).delete(id));
    await finished;
  } finally {
    db.close();
  }
},
};

let activeDriver: ReplayStorageDriver = indexedDbDriver;
export function setReplayStorageDriverForTest(driver: ReplayStorageDriver | undefined): void { activeDriver = driver ?? indexedDbDriver; }

export async function listLocalReplays(): Promise<readonly LocalReplayRecord[]> {
  try { return await activeDriver.list(); } catch { throw new LocalReplayStorageError('STORAGE_READ_FAILED'); }
}
export async function saveLocalReplay(record: LocalReplayRecord): Promise<void> {
  try { await activeDriver.save(record); } catch { throw new LocalReplayStorageError('STORAGE_WRITE_FAILED'); }
}
export async function deleteLocalReplay(id: string): Promise<void> {
  try { await activeDriver.delete(id); } catch { throw new LocalReplayStorageError('STORAGE_WRITE_FAILED'); }
}
