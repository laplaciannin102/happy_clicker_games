import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { SAVE } from '../src/data/save';
import { encodeSave } from '../src/save/codec';
import { checkIntegrity } from '../src/save/integrity';
import { loadFromText } from '../src/save/loader';
import {
  BACKUP_KEYS,
  BROKEN_SAVE_KEY,
  SAVE_KEY,
  clearAllSaves,
  loadFromStorage,
  saveToStorage,
} from '../src/save/storage';
import { memoryStore, playedState } from './helpers';

const NOW = 1_800_000_000_000;

describe('整合性チェック', () => {
  it('正しく遊んだ状態は通る', () => {
    expect(checkIntegrity(playedState(), NOW)).toEqual([]);
  });

  it.each([
    ['yawnsOverTotal', (s: ReturnType<typeof playedState>) => (s.yawns = new Decimal(5_000))],
    ['spentOverTotal', (s: ReturnType<typeof playedState>) => (s.producers.lecture.bought = 30)],
    ['earnedTooFast', (s: ReturnType<typeof playedState>) => (s.totalYawns = new Decimal(1e9))],
    ['clicksTooFast', (s: ReturnType<typeof playedState>) => (s.clicks = 1e7)],
    ['futureSave', (s: ReturnType<typeof playedState>) => (s.lastSavedAt = NOW + 60 * 60_000)],
    ['createdAfterSave', (s: ReturnType<typeof playedState>) => (s.createdAt = s.lastSavedAt + 1)],
    ['lifetimeBelowRun', (s: ReturnType<typeof playedState>) => (s.lifetime.clicks = 10)],
    ['achievementMismatch', (s: ReturnType<typeof playedState>) => s.achievements.set('yawns_10', 0)],
  ])('%s を検出', (issue, edit) => {
    const s = playedState();
    edit(s);
    expect(checkIntegrity(s, NOW)).toContain(issue);
  });

  it('署名が正しくても矛盾があれば tainted になる', async () => {
    const s = playedState();
    s.yawns = new Decimal(1e12);
    s.totalYawns = new Decimal(1e12);
    const result = await loadFromText(await encodeSave(s), NOW, { allowLegacyJson: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.signature).toBe('valid');
    expect(result.value.issues).toContain('earnedTooFast');
    expect(result.value.state.tainted).toBe(true);
  });

  it('tainted は一度立つと保存しても消えない', async () => {
    const s = playedState();
    s.tainted = true;
    const result = await loadFromText(await encodeSave(s), NOW, { allowLegacyJson: false });
    expect(result.ok && result.value.state.tainted).toBe(true);
  });
});

describe('localStorage', () => {
  it('セーブして読み込める', async () => {
    const store = memoryStore();
    expect((await loadFromStorage(store, NOW)).loaded).toBeNull();
    expect(await saveToStorage(playedState(), store, NOW)).toBe(true);
    const load = await loadFromStorage(store, NOW);
    expect(load.source).toBe('main');
    expect(load.loaded?.state.lastSavedAt).toBe(NOW);
    expect(load.loaded?.state.tainted).toBe(false);
  });

  it('バックアップは間隔をあけて最大3世代', async () => {
    const store = memoryStore();
    const s = playedState();
    for (let i = 0; i < 6; i++) await saveToStorage(s, store, NOW + i * SAVE.backupIntervalMs);
    expect(BACKUP_KEYS).toHaveLength(3);
    for (const key of BACKUP_KEYS) expect(store.data.has(key)).toBe(true);
    // 間隔より短いセーブではずらさない
    const before = store.data.get(BACKUP_KEYS[0] ?? '');
    await saveToStorage(s, store, NOW + 5 * SAVE.backupIntervalMs + 1_000);
    expect(store.data.get(BACKUP_KEYS[0] ?? '')).toBe(before);
  });

  it('メインが壊れていたらバックアップから復元し、壊れたメインを返す', async () => {
    const store = memoryStore();
    const s = playedState();
    await saveToStorage(s, store, NOW);
    await saveToStorage(s, store, NOW + SAVE.backupIntervalMs);
    store.data.set(SAVE_KEY, 'akubi|v2|garbage');
    const load = await loadFromStorage(store, NOW + SAVE.backupIntervalMs);
    expect(load.source).toBe(1);
    expect(load.brokenMain).toBe('akubi|v2|garbage');
    expect(load.loaded?.state.producers.cat.bought).toBe(12);
  });

  it('全部壊れていたら何も読まない', async () => {
    const store = memoryStore();
    store.data.set(SAVE_KEY, '{broken');
    const load = await loadFromStorage(store, NOW);
    expect(load.loaded).toBeNull();
    expect(load.brokenMain).toBe('{broken');
  });

  it('書き込みに失敗したら false を返し、状態は変えない', async () => {
    const s = playedState();
    const before = s.lastSavedAt;
    const store = memoryStore();
    store.setItem = () => {
      throw new Error('QuotaExceeded');
    };
    expect(await saveToStorage(s, store, NOW)).toBe(false);
    expect(s.lastSavedAt).toBe(before);
  });

  it('ハードリセットですべてのキーが消える', async () => {
    const store = memoryStore();
    for (let i = 0; i < 4; i++) await saveToStorage(playedState(), store, NOW + i * SAVE.backupIntervalMs);
    store.data.set(BROKEN_SAVE_KEY, 'x');
    store.data.set('other_game_key', 'keep');
    clearAllSaves(store);
    expect([...store.data.keys()]).toEqual(['other_game_key']);
  });

  it('キーはすべて claude_ で始まる', () => {
    for (const key of [SAVE_KEY, BROKEN_SAVE_KEY, ...BACKUP_KEYS]) expect(key.startsWith('claude_')).toBe(true);
  });
});

describe('新しい版のセーブ', () => {
  it('このページより新しい版のメインセーブは、壊れたセーブ扱いにせず「新しい版」と伝える', async () => {
    const store = memoryStore();
    store.data.set(SAVE_KEY, 'akubi|v999|abc|def');
    const load = await loadFromStorage(store, NOW);
    expect(load).toEqual({ loaded: null, source: null, brokenMain: null, newerVersion: true });
  });
});
