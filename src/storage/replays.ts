export interface LocalReplayRecord {
  id: string;
  created_at: string;
  payload: unknown;
}

const DATABASE = 'sailing-training-local-replays-v1';
const STORE = 'replays';

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
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

export async function listLocalReplays(): Promise<readonly LocalReplayRecord[]> {
  const db = await database();
  try {
    const tx = db.transaction(STORE, 'readonly');
    return await requestResult(tx.objectStore(STORE).getAll()) as readonly LocalReplayRecord[];
  } finally {
    db.close();
  }
}

export async function saveLocalReplay(record: LocalReplayRecord): Promise<void> {
  const db = await database();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    await requestResult(tx.objectStore(STORE).put(record));
  } finally {
    db.close();
  }
}

export async function deleteLocalReplay(id: string): Promise<void> {
  const db = await database();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    await requestResult(tx.objectStore(STORE).delete(id));
  } finally {
    db.close();
  }
}
