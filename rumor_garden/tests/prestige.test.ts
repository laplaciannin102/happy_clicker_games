import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { createState } from '../src/state/game';
import { prestigeBalance } from '../src/data/prestige';
import { upgrades } from '../src/data/upgrades';
import { producers } from '../src/data/balance';
import { cost, clickGain, prestigeMultiplier, production, whisper } from '../src/systems/economy';
import { grantAchievements } from '../src/systems/achievements';
import { createPrestigeState, prestigeReward, nextPrestigeTarget, buyPermanentUpgrade } from '../src/systems/prestige';
import { decode, encode, encodeSnapshot, inspect, serialize } from '../src/save/codec';
import { inconsistent } from '../src/save/validation';
import { createSaveActions } from '../src/save/actions';
import { openSave, type StoragePort } from '../src/save/storage';
import { SAVE_KEY } from '../src/config';
import { isRecord } from '../src/save/migrations';
import { compress } from '../src/save/compression';
import { signature, toBase64Url } from '../src/save/crypto';
import { simulate } from '../scripts/simulate';

const now = 1_800_000_000_000;
function qualified(reward = 1) {
  const state = createState(now);
  state.earned = prestigeBalance.requirement.mul(new Decimal(reward).pow(2));
  state.lifetimeEarned = new Decimal(state.earned);
  state.owned.fill(50);
  state.upgrades = upgrades.filter(item => item.producer === null || item.requirement.lte(50)).map(item => item.id);
  const initial = createState(now);
  let spent = new Decimal(0);
  producers.forEach((_, i) => { spent = spent.add(cost(initial, i, state.owned[i])); });
  upgrades.filter(item => state.upgrades.includes(item.id)).forEach(item => { spent = spent.add(item.cost); });
  state.currency = state.earned.sub(spent);
  state.runSeconds = state.playSeconds = 3600 * reward * reward;
  state.runClicks = state.clicks = 7200;
  state.seed = 12345; state.format = 'en'; state.buyMode = 'max';
  grantAchievements(state);
  return state;
}
function memory() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); } };
}

describe('伝説化', () => {
  it('基準未満は報酬0、基準の1・4・9倍で1・2・3語り草になる', () => {
    const state = createState(now);
    state.earned = prestigeBalance.requirement.mul('0.999999');
    expect(prestigeReward(state).eq(0)).toBe(true);
    expect(createPrestigeState(state, now)).toBeNull();
    for (const count of [1, 2, 3, 5, 10, 25, 100]) {
      state.earned = prestigeBalance.requirement.mul(new Decimal(count).pow(2));
      expect(prestigeReward(state).eq(count)).toBe(true);
      expect(nextPrestigeTarget(state).eq(prestigeBalance.requirement.mul(new Decimal(count + 1).pow(2)))).toBe(true);
    }
  });
  it('number上限を超える周回の報酬も有限値として求められる', () => {
    const state = createState(now); state.earned = new Decimal('1e1000');
    expect(prestigeReward(state).isFinite()).toBe(true);
    expect(prestigeReward(state).gt('1e308')).toBe(true);
  });
  it('元の状態を変更せず、周回だけをリセットし、生涯記録・実績・設定を保持する', () => {
    const source = qualified(); source.tainted = true;
    source.events = { wait: 100, visible: 10, boost: 20, collected: 2 };
    const before = serialize(source);
    const next = createPrestigeState(source, now + 1000)!;
    expect(serialize(source)).toBe(before);
    expect(next.currency.eq(0) && next.earned.eq(0)).toBe(true);
    expect(next.owned.every(count => count === 0)).toBe(true); expect(next.upgrades).toEqual([]);
    expect(next.runClicks).toBe(0); expect(next.runSeconds).toBe(0);
    expect(next.lifetimeEarned.eq(source.lifetimeEarned)).toBe(true);
    expect(next.clicks).toBe(source.clicks); expect(next.playSeconds).toBe(source.playSeconds);
    expect(next.seed).toBe(source.seed); expect(next.format).toBe('en'); expect(next.buyMode).toBe('max');
    expect(next.tainted).toBe(true); expect(next.prestige.points.eq(1)).toBe(true);
    expect(next.prestige.count).toBe(1); expect(next.events).toEqual({ wait: -1, visible: 0, boost: 0, collected: 2 });
    expect(source.achievements.every(id => next.achievements.includes(id))).toBe(true);
    expect(next.achievements.includes('prestige-0')).toBe(true);
    expect(prestigeReward(next).eq(0)).toBe(true);
  });
  it('転生直後と再開後の正規データが不正扱いにならない', async () => {
    const source = qualified();
    source.offlineSeconds = 600; source.offlineEarned = new Decimal(100000);
    source.lastOffline = { seconds: 600, gained: new Decimal(10000), capped: false };
    expect(inconsistent(source, now)).toBe(false);
    const next = createPrestigeState(source, now)!;
    expect(next.offlineEarned.eq(source.offlineEarned)).toBe(true);
    expect(next.offlineSeconds).toBe(600);
    expect(inconsistent(next, now)).toBe(false);
    whisper(next);
    const loaded = await decode(await encode(next), now);
    expect(loaded.tainted).toBe(false); expect(serialize(loaded)).toBe(serialize(next));
  });
  it('永続研究は語り草を消費するが累計ボーナスを減らさず、同じ研究は一度だけ', () => {
    const next = createPrestigeState(qualified(5), now)!;
    const bonus = prestigeMultiplier(next), click = clickGain(next);
    expect(buyPermanentUpgrade(next, 'listener')).toBe(true);
    expect(next.prestige.points.eq(0)).toBe(true); expect(next.prestige.total.eq(5)).toBe(true);
    expect(prestigeMultiplier(next).eq(bonus)).toBe(true);
    expect(clickGain(next).div(click).toNumber()).toBeCloseTo(2);
    expect(buyPermanentUpgrade(next, 'listener')).toBe(false);
    expect(buyPermanentUpgrade(next, 'inheritance')).toBe(false);
    expect(buyPermanentUpgrade(next, 'missing')).toBe(false);
    expect(inconsistent(next, now)).toBe(false);
  });
  it('引き継ぎ研究の5組は次の転生から適用し、購入価格と支出検査に無料分を含めない', () => {
    const first = createPrestigeState(qualified(10), now)!;
    expect(buyPermanentUpgrade(first, 'inheritance')).toBe(true);
    expect(first.owned[0]).toBe(0);
    first.earned = prestigeBalance.requirement; first.lifetimeEarned = first.lifetimeEarned.add(first.earned);
    const next = createPrestigeState(first, now)!;
    expect(next.owned[0]).toBe(5); expect(next.startingNeighbors).toBe(5);
    expect(cost(next, 0).eq(10)).toBe(true); expect(production(next).gt(0)).toBe(true);
    expect(inconsistent(next, now)).toBe(false);
  });
});

describe('保存と確認', () => {
  it('署名付きv3を移行し、旧累計を今回と生涯の記録へ引き継ぐ', async () => {
    const source = qualified();
    const data: unknown = JSON.parse(serialize(source));
    if (!isRecord(data)) throw new Error('fixture');
    for (const key of ['lifetimeEarned', 'runSeconds', 'runClicks', 'startingNeighbors', 'prestige', 'records', 'tale', 'generated', 'lastOfflineGenerated', 'myth', 'challenge', 'automation', 'preferences', 'mail']) delete data[key];
    data.version = 3;
    const message = `rumor|v3|${toBase64Url(await compress(JSON.stringify(data)))}`;
    const loaded = await inspect(`${message}|${toBase64Url(await signature(message))}`, now);
    expect(loaded.signatureValid).toBe(true); expect(loaded.state.tainted).toBe(false);
    expect(loaded.state.earned.eq(source.earned)).toBe(true);
    expect(loaded.state.lifetimeEarned.eq(source.earned)).toBe(true);
    expect(loaded.state.runSeconds).toBe(source.playSeconds); expect(loaded.state.runClicks).toBe(source.clicks);
    expect(loaded.state.prestige.count).toBe(0);
    expect(loaded.state.records.maxOwned).toEqual(source.owned);
  });
  it('キャンセルした転生は進行と主セーブを変更しない', async () => {
    const storage = memory(), session = await openSave(storage, now);
    await session.replace(qualified());
    const before = storage.getItem(SAVE_KEY);
    const actions = createSaveActions(session, { synchronize() {}, changed() {}, notify() {}, confirm: () => false });
    await actions.prestige();
    expect(storage.getItem(SAVE_KEY)).toBe(before); expect(session.state.prestige.count).toBe(0);
  });
  it('確認した転生は保存後に採用され、同じ周回から二重受け取りできない', async () => {
    const storage = memory(), session = await openSave(storage, now);
    await session.replace(qualified());
    let prompts = 0;
    const actions = createSaveActions(session, { synchronize() {}, changed() {}, notify() {}, confirm() { prompts++; return true; } });
    await actions.prestige(); await actions.prestige();
    expect(prompts).toBe(1); expect(session.state.prestige.count).toBe(1);
    expect((await openSave(storage, now)).state.prestige.points.eq(1)).toBe(true);
    expect((await session.backups()).some(item => item.state.prestige.count === 0 && item.state.earned.gte(prestigeBalance.requirement))).toBe(true);
  });
  it('保存に失敗した転生では現在の進行を保持する', async () => {
    const storage = memory(); let full = false;
    const port: StoragePort = { ...storage, setItem(key, value) { if (full) throw new Error('full'); storage.setItem(key, value); } };
    const session = await openSave(port, now); await session.replace(qualified());
    const before = storage.getItem(SAVE_KEY); full = true;
    const actions = createSaveActions(session, { synchronize() {}, changed() {}, notify() {}, confirm: () => true });
    await actions.prestige();
    expect(session.state.prestige.count).toBe(0); expect(session.state.earned.gte(prestigeBalance.requirement)).toBe(true);
    full = false; session.flush(); expect(storage.getItem(SAVE_KEY)).toBe(before);
  });
  it('語り草・転生回数・生涯記録の矛盾を検出する', async () => {
    const source = createPrestigeState(qualified(), now)!;
    const data: unknown = JSON.parse(serialize(source));
    if (!isRecord(data)) throw new Error('fixture');
    for (const patch of [{ prestige: { ...source.prestige, points: '99', total: '1', lastGain: '1' } },
      { lifetimeEarned: '0' }, { runClicks: source.clicks + 1 },
      { startingNeighbors: 5, owned: [5, 0, 0, 0, 0, 0, 0, 0, 0, 0] }]) {
      expect((await decode(await encodeSnapshot(JSON.stringify({ ...data, ...patch })), now)).tainted).toBe(true);
    }
  });
});

it('初回伝説化が能動ボットで目標30〜60分に入り、転生後も正規の記録になる', () => {
  const { state, report } = simulate('active', 3600, { stopAt: prestigeBalance.requirement });
  expect(state.earned.gte(prestigeBalance.requirement)).toBe(true);
  expect(report.seconds).toBeGreaterThanOrEqual(1800); expect(report.seconds).toBeLessThanOrEqual(3600);
  expect(report.milestones.firstPurchase).toBeLessThanOrEqual(10);
  expect(inconsistent(state, state.lastUpdatedAt)).toBe(false);
  expect(inconsistent(createPrestigeState(state, state.lastUpdatedAt)!, state.lastUpdatedAt)).toBe(false);
}, 30_000);
