import { afterEach, describe, expect, it } from 'vitest';
import { deleteLocalReplay, listLocalReplays, saveLocalReplay, setReplayStorageDriverForTest, type LocalReplayRecord, type ReplayStorageDriver } from '../../src/storage/replays.js';

class ScriptedDriver implements ReplayStorageDriver {
  records: LocalReplayRecord[] = [];
  failRead = false; failWrite = false; abortWrite = false;
  async list() { if (this.failRead) throw new Error('corrupt/read failure'); return this.records.map((record) => ({ ...record })); }
  async save(record: LocalReplayRecord) { if (this.failWrite || this.abortWrite) throw new Error('quota/interrupted write'); this.records = [...this.records, record]; }
  async delete(id: string) { if (this.failWrite) throw new Error('write failure'); this.records = this.records.filter((record) => record.id !== id); }
}
const first = { id: 'first', created_at: 'synthetic', payload: { opaque: true } };
const second = { id: 'second', created_at: 'synthetic', payload: { corrupt: true } };
afterEach(() => setReplayStorageDriverForTest(undefined));

describe('local replay storage resilience', () => {
  it('preserves prior raw records on quota/rejected and interrupted staged writes', async () => {
    const driver = new ScriptedDriver(); driver.records = [first]; setReplayStorageDriverForTest(driver);
    driver.failWrite = true;
    await expect(saveLocalReplay(second)).rejects.toMatchObject({ code: 'STORAGE_WRITE_FAILED' });
    driver.failWrite = false; driver.abortWrite = true;
    await expect(saveLocalReplay(second)).rejects.toMatchObject({ code: 'STORAGE_WRITE_FAILED' });
    expect(await listLocalReplays()).toEqual([first]);
  });
  it('returns stable read failure and supports explicit per-record deletion only', async () => {
    const driver = new ScriptedDriver(); driver.records = [first, second]; setReplayStorageDriverForTest(driver);
    await deleteLocalReplay('second');
    expect(await listLocalReplays()).toEqual([first]);
    driver.failRead = true;
    await expect(listLocalReplays()).rejects.toMatchObject({ code: 'STORAGE_READ_FAILED' });
  });
});
