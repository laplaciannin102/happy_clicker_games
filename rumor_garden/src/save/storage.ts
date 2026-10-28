import { SAVE_KEY } from '../config';
import { balance } from '../data/balance';
import { createState, type GameState } from '../state/game';
import { decode, encodeSnapshot, serialize } from './codec';
import { UnsupportedSaveError } from './migrations';

export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export type SaveResult = 'saved' | 'blocked' | 'failed' | 'conflict' | 'obsolete' | 'reset-partial';
interface Prepared { raw: string; json: string; epoch: number; revision: number }
export interface Backup { slot: number; state: GameState }

export async function openSave(storage: StoragePort, now: number) {
  const state = createState(now);
  let status: 'new' | 'loaded' | 'recovered' | 'blocked' = 'new';
  let expected: string | null = null;
  let blocked: 'corrupt' | 'read' | 'conflict' | null = null;
  let previousValid = false;
  let epoch = 0, revision = 0, committed = -1;
  let latest: Prepared | null = null;
  let preparing: { json: string; promise: Promise<Prepared | null> } | null = null;
  const backupKey = (slot: number) => `${SAVE_KEY}_backup_${slot}`;

  try {
    expected = storage.getItem(SAVE_KEY);
    if (expected !== null) {
      try { Object.assign(state, await decode(expected, now, 'local')); status = 'loaded'; previousValid = true; }
      catch (error) {
        status = 'blocked'; blocked = 'corrupt';
        if (error instanceof UnsupportedSaveError) throw error;
        for (let i = 0; i < balance.backupCount; i++) {
          const backup = storage.getItem(backupKey(i));
          if (backup === null) continue;
          try {
            Object.assign(state, await decode(backup, now, 'local'));
            status = 'recovered'; blocked = null; break;
          } catch { /* try older */ }
        }
      }
    }
  } catch { status = 'blocked'; blocked = 'read'; }

  function prepare(current: GameState): Promise<Prepared | null> {
    const json = serialize(current);
    if (latest?.epoch === epoch && latest.json === json) return Promise.resolve(latest);
    if (preparing?.json === json) return preparing.promise;
    const ticket = { epoch, revision: ++revision };
    const promise = encodeSnapshot(json).then(raw => {
      if (ticket.epoch !== epoch) return null;
      const prepared = { raw, json, ...ticket };
      if (!latest || latest.revision < prepared.revision) latest = prepared;
      return prepared;
    });
    preparing = { json, promise };
    void promise.finally(() => { if (preparing?.promise === promise) preparing = null; }).catch(() => undefined);
    return promise;
  }

  function commit(prepared: Prepared | null, replace = false): SaveResult {
    if (!prepared || prepared.epoch !== epoch || prepared.revision < committed) return 'obsolete';
    if (blocked && !(replace && blocked === 'corrupt')) return blocked === 'conflict' ? 'conflict' : 'blocked';
    try {
      const previous = storage.getItem(SAVE_KEY);
      if (previous !== expected) { blocked = 'conflict'; return 'conflict'; }
      if (previous === prepared.raw) return 'saved';
      if (previous !== null && previousValid) {
        for (let i = balance.backupCount - 1; i > 0; i--) {
          const older = storage.getItem(backupKey(i - 1));
          if (older !== null) storage.setItem(backupKey(i), older);
        }
        storage.setItem(backupKey(0), previous);
      }
      storage.setItem(SAVE_KEY, prepared.raw);
      expected = prepared.raw; previousValid = true; blocked = null;
      committed = prepared.revision;
      return 'saved';
    } catch { return 'failed'; }
  }

  async function save(current: GameState): Promise<SaveResult> {
    try { return commit(await prepare(current)); } catch { return 'failed'; }
  }
  function flush(): SaveResult { return latest ? commit(latest) : 'failed'; }

  async function replace(next: GameState, reset = false): Promise<SaveResult> {
    epoch++; latest = null; preparing = null;
    try {
      const result = commit(await prepare(next), true);
      if (result !== 'saved') { epoch++; latest = null; preparing = null; return result; }
      Object.assign(state, next);
      if (reset) {
        try { for (let i = 0; i < balance.backupCount; i++) storage.removeItem(backupKey(i)); }
        catch { return 'reset-partial'; }
      }
      return 'saved';
    } catch { epoch++; latest = null; preparing = null; return 'failed'; }
  }

  async function backups(): Promise<Backup[]> {
    const available: Backup[] = [];
    for (let i = 0; i < balance.backupCount; i++) {
      const raw = storage.getItem(backupKey(i));
      if (raw === null) continue;
      try { available.push({ slot: i, state: await decode(raw, Date.now(), 'local') }); }
      catch { /* invalid backups are not offered */ }
    }
    return available;
  }
  return { state, status, prepare, save, flush, replace, backups };
}
export type SaveSession = Awaited<ReturnType<typeof openSave>>;
