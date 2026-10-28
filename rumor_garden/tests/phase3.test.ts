import Decimal from 'break_eternity.js';
import { expect, it } from 'vitest';
import { createState } from '../src/state/game';
import { balance, producers } from '../src/data/balance';
import { upgrades } from '../src/data/upgrades';
import { achievements } from '../src/data/achievements';
import { advance, buy, clickGain, production, whisper } from '../src/systems/economy';
import { buyUpgrade } from '../src/systems/upgrades';
import { grantAchievements } from '../src/systems/achievements';
import { advanceOnline, collectEvent } from '../src/systems/events';
import { catchUp } from '../src/core/time';
import { decode, encode } from '../src/save/codec';
import { inconsistent } from '../src/save/validation';
import { simulate } from '../scripts/simulate';
import { inspect, serialize, encodeSnapshot } from '../src/save/codec';
import { compress } from '../src/save/compression';
import { signature, toBase64Url } from '../src/save/crypto';
import { isRecord } from '../src/save/migrations';

function established() {
  const state = createState(0);
  state.owned[0] = 1; state.currency = state.earned = new Decimal(5000);
  state.clicks = 5000; state.playSeconds = 1000;
  grantAchievements(state); return state;
}

it('10生産者・43研究・神話と試練分を含む68個の重複しない実績がある', () => {
  expect(producers).toHaveLength(10); expect(upgrades).toHaveLength(43);
  expect(achievements).toHaveLength(68); expect(new Set(achievements.map(item => item.id)).size).toBe(68);
  expect(achievements.some(item => item.hidden)).toBe(true);
});
it('研究条件・費用・重複購入を検証し、生産倍率を乗算する', () => {
  const state = createState(0); state.currency = state.earned = new Decimal('1e12');
  expect(buyUpgrade(state, 'neighbors-10')).toBe(false);
  buy(state, 0, 100);
  const before = production(state);
  expect(buyUpgrade(state, 'neighbors-10')).toBe(true);
  expect(production(state).div(before).toNumber()).toBeCloseTo(2);
  expect(buyUpgrade(state, 'neighbors-10')).toBe(false);
  expect(buyUpgrade(state, 'neighbors-25')).toBe(true);
  expect(production(state).div(before).toNumber()).toBeCloseTo(4);
  expect(buyUpgrade(state, 'unknown')).toBe(false);
});
it('クリック研究は加算してから実績倍率を適用する', () => {
  const state = createState(0); state.currency = state.earned = new Decimal(5000);
  expect(buyUpgrade(state, 'whisper-0')).toBe(true);
  expect(clickGain(state).toNumber()).toBeCloseTo(2);
  expect(buyUpgrade(state, 'whisper-1')).toBe(true);
  expect(clickGain(state).toNumber()).toBeCloseTo(5);
});
it('実績を重複付与せず、数に応じて基礎クリックと生産へ小ボーナスを付ける', () => {
  const state = createState(0); whisper(state);
  const count = state.achievements.length;
  expect(count).toBe(1); expect(clickGain(state).toNumber()).toBeCloseTo(1.005);
  grantAchievements(state); expect(state.achievements).toHaveLength(count);
  expect(state.achievements.includes('secret-circle')).toBe(false);
  state.owned.fill(3); grantAchievements(state);
  expect(state.achievements.includes('secret-circle')).toBe(true);
});
it('保存したシード・待ち時間から同じイベントを再現し、15秒で失効する', async () => {
  const a = established(); advanceOnline(a, 1);
  const b = await decode(await encode(a), Date.now());
  const wait = a.events.wait;
  expect(wait).toBeGreaterThanOrEqual(89); expect(wait).toBeLessThanOrEqual(149);
  advanceOnline(a, wait); advanceOnline(b, wait);
  expect(a.events.visible).toBe(balance.eventVisibleSeconds);
  expect(a.events).toEqual(b.events); expect(a.seed).toBe(b.seed);
  const nextWait = a.events.wait;
  advanceOnline(a, 15); expect(a.events.visible).toBe(0);
  expect(a.events.wait).toBeCloseTo(nextWait - 15);
  expect(collectEvent(a)).toBe(false);
});
it('回収は1回だけ有効で、ブーストを加算せず30秒へ更新する', () => {
  const state = established(); state.events.visible = 5;
  expect(collectEvent(state)).toBe(true); expect(collectEvent(state)).toBe(false);
  expect(state.events.collected).toBe(1); expect(state.events.boost).toBe(30);
  state.events.visible = 5; state.events.boost = 10;
  collectEvent(state); expect(state.events.boost).toBe(30);
  const base = production(state, false);
  expect(production(state).div(base).toNumber()).toBeCloseTo(3);
});
it('オフライン中は出現も回収もせず、残りブーストの区間だけ倍率を掛ける', () => {
  const state = established(); state.events.wait = 2; state.events.visible = 5; state.events.boost = 10;
  const base = production(state, false);
  const gained = catchUp(state, 40_000);
  expect(gained.toNumber()).toBeCloseTo(base.mul(60).toNumber(), 6);
  expect(state.events.visible).toBe(0); expect(state.events.collected).toBe(0);
  expect(state.events.wait).toBe(2); expect(state.events.boost).toBe(0);
  expect(state.lastOffline.seconds).toBe(40); expect(state.offlineEarned.eq(gained)).toBe(true);
});
it('実績の解放・倍率変化とブースト終了を挟んでもオンラインとオフラインの生産が一致する', () => {
  const a = createState(0), b = createState(0);
  a.owned[0] = b.owned[0] = 10;
  a.events.boost = b.events.boost = 10;
  for (let tick = 0; tick < 2400; tick++) advance(a, 0.05);
  catchUp(b, 120_000);
  expect(a.currency.toNumber()).toBeCloseTo(b.currency.toNumber(), 6);
  expect(new Set(a.achievements)).toEqual(new Set(b.achievements));
});
it('30分の購入ボットが研究と複数の生産者を使って進行し、正規セーブとして検証される', () => {
  const { state, report } = simulate('active');
  expect(report.milestones.firstPurchase).toBeLessThanOrEqual(10);
  expect(report.milestones.thirdVisible).toBeGreaterThan(0);
  expect(report.milestones.thirdVisible).toBeLessThanOrEqual(60);
  expect(state.owned[3]).toBeGreaterThan(0); expect(state.upgrades.length).toBeGreaterThan(5);
  expect(state.achievements.length).toBeGreaterThan(10);
  expect(state.currency.isFinite() && state.currency.gte(0)).toBe(true);
  expect(inconsistent(state, 1800_000)).toBe(false);
}, 30_000);

it('署名付きv2を検証してからv3へ移し、研究と残り7生産者を初期化する', async () => {
  const old = { version: 2, currency: '90', earned: '100', owned: [1, 0, 0], clicks: 100,
    playSeconds: 10, lastUpdatedAt: 10000, seed: 12345, format: 'ja', buyMode: 10, tainted: false };
  const body = toBase64Url(await compress(JSON.stringify(old)));
  const message = `rumor|v2|${body}`;
  const raw = `${message}|${toBase64Url(await signature(message))}`;
  const loaded = await inspect(raw, 10000);
  expect(loaded.signatureValid).toBe(true); expect(loaded.state.tainted).toBe(false);
  expect(loaded.state.owned).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  expect(loaded.state.currency.eq(90)).toBe(true); expect(loaded.state.seed).toBe(12345);
  expect(loaded.state.upgrades).toEqual([]); expect(loaded.state.achievements.length).toBeGreaterThan(0);
  expect(await encode(loaded.state)).toMatch(/^rumor\|v8\|/);
});
it('新しい研究・実績・イベント・オフライン記録を署名付きで往復する', async () => {
  const { state } = simulate('active', 600);
  catchUp(state, 700000);
  const loaded = await decode(await encode(state), 700000);
  expect(loaded.tainted).toBe(false);
  expect(serialize(loaded)).toBe(serialize(state));
}, 30_000);
it('未解放研究と未達成実績、矛盾するオフライン記録に改造印を付ける', async () => {
  const data: unknown = JSON.parse(serialize(createState(0)));
  if (!isRecord(data)) throw new Error('fixture');
  for (const patch of [{ upgrades: ['world-100'] }, { achievements: ['secret-circle'] }, { offlineSeconds: 100 }]) {
    const raw = await encodeSnapshot(JSON.stringify({ ...data, ...patch }));
    expect((await decode(raw, 0)).tainted).toBe(true);
  }
});
it('存在しないID・重複した実績・壊れたイベント構造は読み込まない', async () => {
  const data: unknown = JSON.parse(serialize(createState(0)));
  if (!isRecord(data)) throw new Error('fixture');
  for (const patch of [{ upgrades: ['not-an-upgrade'] }, { achievements: ['clicks-0', 'clicks-0'] },
    { events: { wait: 0, visible: 0, boost: 999, collected: 0 } }]) {
    await expect(decode(await encodeSnapshot(JSON.stringify({ ...data, ...patch })))).rejects.toThrow();
  }
});
