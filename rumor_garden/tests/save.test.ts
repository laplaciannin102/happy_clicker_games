import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { createState, type GameState } from '../src/state/game';
import { decode, encode, encodeSnapshot, inspect, serialize } from '../src/save/codec';
import { openSave, type StoragePort } from '../src/save/storage';
import { compress, decompress } from '../src/save/compression';
import { fromBase64Url, toBase64Url } from '../src/save/crypto';
import { MAX_SAVE_SIZE, SAVE_KEY, SAVE_VERSION } from '../src/config';
import { advance, buy, whisper } from '../src/systems/economy';
import { isRecord } from '../src/save/migrations';

const now = 1_800_000_000_000;
export function memory() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); } };
}
function played() {
  const state = createState(now);
  for (let i = 0; i < 100; i++) whisper(state);
  buy(state, 0, 1); buy(state, 1, 1); advance(state, 60);
  state.lastUpdatedAt = now + 60_000;
  return state;
}
function payload(state = played()) {
  const data: unknown = JSON.parse(serialize(state));
  if (!isRecord(data)) throw new Error('fixture');
  return data;
}
function legacy(state: GameState) {
  const data = payload(state); delete data.tainted;
  for (const key of ['upgrades', 'achievements', 'events', 'offlineSeconds', 'offlineEarned', 'lastOffline']) delete data[key];
  for (const key of ['lifetimeEarned', 'runSeconds', 'runClicks', 'startingNeighbors', 'prestige', 'records', 'tale', 'generated', 'lastOfflineGenerated', 'myth', 'challenge', 'automation', 'preferences', 'mail']) delete data[key];
  data.owned = state.owned.slice(0, 3);
  return JSON.stringify({ ...data, version: 1 });
}

async function tamper(raw: string, patch: Record<string, unknown>) {
  const parts = raw.split('|');
  const data: unknown = JSON.parse(await decompress(fromBase64Url(parts[2])));
  if (!isRecord(data)) throw new Error('fixture');
  parts[2] = toBase64Url(await compress(JSON.stringify({ ...data, ...patch })));
  return parts.join('|');
}

describe('圧縮・署名・移行', () => {
  it('指定の4区切り形式で保存し、Decimal・設定・時刻を往復する', async () => {
    const state = played(); state.format = 'scientific'; state.buyMode = 'max';
    const raw = await encode(state);
    expect(raw).toMatch(/^rumor\|v8\|[\w-]+\|[\w-]{22}$/);
    const loaded = await inspect(raw, now + 60_000);
    expect(loaded.signatureValid).toBe(true);
    expect(loaded.state.tainted).toBe(false);
    expect(serialize(loaded.state)).toBe(serialize(state));
  });
  it('number上限を超えるDecimalを文字列のまま維持する', async () => {
    const state = played();
    state.currency = new Decimal('1e5000'); state.earned = new Decimal('ee1000');
    const loaded = await decode(await encode(state));
    expect(loaded.currency.eq(state.currency)).toBe(true);
    expect(loaded.earned.eq(state.earned)).toBe(true);
  });
  it('署名を残した本体の書き換えを検出し、遊べる状態へ改造印を付ける', async () => {
    const modified = await tamper(await encode(played()), { currency: '1' });
    const loaded = await inspect(modified, now + 60_000);
    expect(loaded.signatureValid).toBe(false);
    expect(loaded.state.currency.eq(1)).toBe(true);
    expect(loaded.state.tainted).toBe(true);
    expect((await decode(await encode(loaded.state))).tainted).toBe(true);
  });
  it('旧v1のlocalStorage保存を、進行と設定を失わず自動移行する', async () => {
    const state = played(); state.format = 'en'; state.buyMode = 10;
    const loaded = await inspect(legacy(state), now + 60_000, 'local');
    expect(loaded.legacy).toBe(true);
    expect(loaded.state.tainted).toBe(false);
    expect(loaded.state.currency.eq(state.currency)).toBe(true);
    expect(loaded.state.owned).toEqual(state.owned);
    expect(new Set(loaded.state.achievements)).toEqual(new Set(state.achievements));
    expect(await encode(loaded.state)).toMatch(/^rumor\|v8\|/);
    expect((await decode(legacy(state), now + 60_000, 'import')).tainted).toBe(true);
  });
  it('圧縮前・展開後の過大入力を拒否する', async () => {
    await expect(decode('x'.repeat(MAX_SAVE_SIZE + 1))).rejects.toThrow();
    const raw = await encodeSnapshot(' '.repeat(MAX_SAVE_SIZE + 1));
    await expect(decode(raw)).rejects.toThrow();
  });
  it.each(['{', '{}', 'null', '[]', 'rumor|v99|a|b', 'other|v2|a|b', 'rumor|v2|%%%|abc'])
    ('破損・別ゲーム・未対応バージョンを拒否する (%#)', async raw => {
      await expect(decode(raw)).rejects.toThrow();
    });
  it.each([
    { currency: '-1' }, { currency: 'Infinity' }, { currency: 'garbage' },
    { owned: [-1, 0, 0] }, { owned: [1.5, 0, 0] }, { owned: [0, 0] },
    { lastUpdatedAt: -1 }, { format: 'other' }, { tainted: 'false' },
    { version: 99 }, { unknown: 1 },
  ])('署名があっても不正な構造を拒否する (%#)', async patch => {
    await expect(decode(await encodeSnapshot(JSON.stringify({ ...payload(), ...patch })))).rejects.toThrow();
  });
});

describe('整合性検査', () => {
  it.each([
    { currency: '999999' }, { earned: '1e5000' }, { owned: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0] },
    { owned: [100, 1, 0, 0, 0, 0, 0, 0, 0, 0] }, { lastUpdatedAt: now + 120_000 },
  ])('正しい署名でも到達記録・解放・支出・未来時刻の矛盾に改造印を付ける (%#)', async patch => {
    const raw = await encodeSnapshot(JSON.stringify({ ...payload(), ...patch }));
    const loaded = await inspect(raw, now + 60_000);
    expect(loaded.signatureValid).toBe(true);
    expect(loaded.state.tainted).toBe(true);
  });
  it('正規の5分進行を改造扱いしない', async () => {
    const state = createState(now);
    for (let i = 0; i < 6000; i++) {
      advance(state, 0.05);
      if (i % 10 === 0) whisper(state);
      const index = state.owned.findIndex(count => count === 0);
      buy(state, index < 0 ? 0 : index, 1);
    }
    state.lastUpdatedAt = now + 300_000;
    expect((await decode(await encode(state), now + 300_000)).tainted).toBe(false);
  });
});

describe('永続保存と競合', () => {
  it('初回保存・再読込と3世代のバックアップを保持する', async () => {
    const storage = memory(), session = await openSave(storage, now);
    for (let i = 0; i < 5; i++) {
      whisper(session.state);
      expect(await session.save(session.state)).toBe('saved');
    }
    expect((await openSave(storage, now)).state.clicks).toBe(5);
    expect((await decode(storage.getItem(`${SAVE_KEY}_backup_0`)!)).clicks).toBe(4);
    expect((await decode(storage.getItem(`${SAVE_KEY}_backup_2`)!)).clicks).toBe(2);
    expect((await session.backups()).map(item => item.slot)).toEqual([0, 1, 2]);
  });
  it('旧形式を含むバックアップから破損した本体を復元できる', async () => {
    const storage = memory(), state = played();
    storage.setItem(SAVE_KEY, 'broken');
    storage.setItem(`${SAVE_KEY}_backup_0`, legacy(state));
    const session = await openSave(storage, now + 60_000);
    expect(session.status).toBe('recovered');
    expect(session.state.currency.eq(state.currency)).toBe(true);
    expect(session.state.owned).toEqual(state.owned);
    expect(await session.save(session.state)).toBe('saved');
    expect(storage.getItem(`${SAVE_KEY}_backup_0`)).toBe(legacy(state));
  });
  it('復元不能な保存を上書きせず、明示的な置換で復旧できる', async () => {
    const storage = memory(); storage.setItem(SAVE_KEY, 'broken');
    const session = await openSave(storage, now);
    expect(session.status).toBe('blocked');
    expect(await session.save(session.state)).toBe('blocked');
    expect(storage.getItem(SAVE_KEY)).toBe('broken');
    expect(await session.replace(createState(now))).toBe('saved');
  });
  it('アクセス拒否と容量不足を通知する', async () => {
    const denied: StoragePort = { getItem() { throw new Error('denied'); },
      setItem() { throw new Error('denied'); }, removeItem() {} };
    expect((await openSave(denied, now)).status).toBe('blocked');
    const full: StoragePort = { getItem: () => null, setItem() { throw new Error('full'); }, removeItem() {} };
    const session = await openSave(full, now);
    expect(await session.save(session.state)).toBe('failed');
  });
  it('他のタブの保存を上書きしない', async () => {
    const storage = memory();
    const first = await openSave(storage, now), second = await openSave(storage, now);
    whisper(first.state); await first.save(first.state);
    expect(await second.save(second.state)).toBe('conflict');
    expect((await openSave(storage, now)).state.clicks).toBe(1);
  });
  it('未対応の新しい版を古いバックアップで自動上書きしない', async () => {
    const storage = memory();
    const raw = (await encode(createState(now))).replace(`|v${SAVE_VERSION}|`, `|v${SAVE_VERSION + 1}|`);
    storage.setItem(SAVE_KEY, raw);
    storage.setItem(`${SAVE_KEY}_backup_0`, await encode(createState(now)));
    const session = await openSave(storage, now);
    expect(session.status).toBe('blocked');
    expect(await session.save(session.state)).toBe('blocked');
    expect(storage.getItem(SAVE_KEY)).toBe(raw);
  });
  it('署名の完了順にかかわらず新しいスナップショットを保持する', async () => {
    const storage = memory(), session = await openSave(storage, now);
    const old = session.save(session.state);
    whisper(session.state);
    await session.save(session.state); await old;
    expect((await openSave(storage, now)).state.clicks).toBe(1);
  });
  it('終了時は準備済みの署名を同期保存できる', async () => {
    const storage = memory(), session = await openSave(storage, now);
    whisper(session.state); await session.prepare(session.state);
    expect(session.flush()).toBe('saved');
    expect((await openSave(storage, now)).state.clicks).toBe(1);
  });
  it('リセット前に走っていた署名処理はリセット後の進行を上書きしない', async () => {
    const storage = memory(), session = await openSave(storage, now);
    whisper(session.state); await session.save(session.state);
    whisper(session.state);
    const oldSave = session.save(session.state);
    expect(await session.replace(createState(now), true)).toBe('saved');
    await oldSave;
    expect((await openSave(storage, now)).state.clicks).toBe(0);
    expect((await session.backups()).length).toBe(0);
  });
  it('置換の保存に失敗したら現在の状態を維持し、後のflushでも置換しない', async () => {
    const storage = memory();
    let full = false;
    const port: StoragePort = { ...storage,
      setItem(key, value) { if (full) throw new Error('full'); storage.setItem(key, value); } };
    const session = await openSave(port, now);
    whisper(session.state); await session.save(session.state);
    full = true;
    expect(await session.replace(createState(now))).toBe('failed');
    expect(session.state.clicks).toBe(1);
    full = false; session.flush();
    expect((await openSave(storage, now)).state.clicks).toBe(1);
  });
});
