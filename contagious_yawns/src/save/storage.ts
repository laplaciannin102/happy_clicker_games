import { GAME_ID, storageKey } from '../config';
import { SAVE } from '../data/save';
import type { GameState } from '../state/gameState';
import { encodeSave } from './codec';
import { loadFromText, type LoadedSave } from './loader';

export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const SAVE_KEY = storageKey('save');
export const BACKUP_KEYS: readonly string[] = Array.from({ length: SAVE.backupCount }, (_, i) =>
  storageKey(`save_backup${i + 1}`),
);
export const BACKUP_ROTATED_AT_KEY = storageKey('save_backup_at');
export const BROKEN_SAVE_KEY = storageKey('save_broken');

export interface StorageLoad {
  loaded: LoadedSave | null;
  /** どこから読めたか（'main'、またはバックアップの世代番号 1〜） */
  source: 'main' | number | null;
  /** 読めなかったメインのセーブ（退避用） */
  brokenMain: string | null;
  /**
   * メインのセーブがこのページより新しい版だった（公開直後に古いページがキャッシュから開かれたときなど）。
   * このときは何も読まず、上書きもしない。
   */
  newerVersion: boolean;
}

function get(storage: KeyValueStore, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/** メインのセーブを読む。壊れていたら新しいバックアップから順に試す（SPEC §6.1）。 */
export async function loadFromStorage(storage: KeyValueStore, now: number): Promise<StorageLoad> {
  const main = get(storage, SAVE_KEY);
  if (main === null) return { loaded: null, source: null, brokenMain: null, newerVersion: false };

  const result = await loadFromText(main, now, { allowLegacyJson: true });
  if (result.ok) return { loaded: result.value, source: 'main', brokenMain: null, newerVersion: false };
  if (result.error === 'newerVersion') return { loaded: null, source: null, brokenMain: null, newerVersion: true };

  for (const [i, key] of BACKUP_KEYS.entries()) {
    const text = get(storage, key);
    if (text === null) continue;
    const backup = await loadFromText(text, now, { allowLegacyJson: false });
    if (backup.ok) return { loaded: backup.value, source: i + 1, brokenMain: main, newerVersion: false };
  }
  return { loaded: null, source: null, brokenMain: main, newerVersion: false };
}

/** いまのメインを1世代目のバックアップに回す。前回から backupIntervalMs 未満なら回さない。 */
function rotateBackups(storage: KeyValueStore, now: number): void {
  const current = storage.getItem(SAVE_KEY);
  // 壊れたデータや旧形式でバックアップを押し出さない
  if (current === null || !current.startsWith(`${GAME_ID}|`)) return;
  const first = BACKUP_KEYS[0];
  if (first === undefined) return;

  const last = Number(storage.getItem(BACKUP_ROTATED_AT_KEY) ?? 0);
  const recent = now >= last && now - last < SAVE.backupIntervalMs;
  if (recent && storage.getItem(first) !== null) return;

  for (let i = BACKUP_KEYS.length - 1; i > 0; i--) {
    const from = BACKUP_KEYS[i - 1];
    const to = BACKUP_KEYS[i];
    if (from === undefined || to === undefined) continue;
    const text = storage.getItem(from);
    if (text !== null) storage.setItem(to, text);
  }
  storage.setItem(first, current);
  storage.setItem(BACKUP_ROTATED_AT_KEY, String(now));
}

/** 署名つきでセーブする。成功したら true。失敗したら状態は変えない。 */
export async function saveToStorage(
  state: GameState,
  storage: KeyValueStore,
  now: number,
): Promise<boolean> {
  const prev = state.lastSavedAt;
  state.lastSavedAt = now;
  try {
    const encoded = await encodeSave(state);
    rotateBackups(storage, now);
    storage.setItem(SAVE_KEY, encoded);
    return true;
  } catch {
    state.lastSavedAt = prev;
    return false;
  }
}

/** 読めなかったセーブを、上書きされる前に別のキーへ退避する。 */
export function quarantineBrokenSave(storage: KeyValueStore, raw: string): boolean {
  try {
    storage.setItem(BROKEN_SAVE_KEY, raw);
    return true;
  } catch {
    return false;
  }
}

/** ハードリセット用：このゲームのセーブをすべて消す。 */
export function clearAllSaves(storage: KeyValueStore): void {
  for (const key of [SAVE_KEY, ...BACKUP_KEYS, BACKUP_ROTATED_AT_KEY, BROKEN_SAVE_KEY]) {
    try {
      storage.removeItem(key);
    } catch {
      // 消せなくても、直後に新しい状態で上書きする
    }
  }
}
