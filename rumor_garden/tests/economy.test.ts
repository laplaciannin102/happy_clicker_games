import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { createState } from '../src/state/game';
import { advance, buy, clickGain, cost, production, purchaseQuantity, unlocked, whisper } from '../src/systems/economy';
import { catchUp, tickTo } from '../src/core/time';
import { balance } from '../src/data/balance';
import { upgrades } from '../src/data/upgrades';

describe('伝聞の経済', () => {
  it('初期状態は実績が増えても、購入するまで1クリックを厳密に1として加算する', () => {
    const state = createState(0); advance(state,1800);
    for(let i=0;i<1000;i++) {
      const before=state.currency; expect(clickGain(state).eq(1)).toBe(true); whisper(state);
      expect(state.currency.sub(before).eq(1)).toBe(true);
    }
    expect(state.achievements.length).toBeGreaterThan(1);
    expect(state.currency.eq(1000)).toBe(true); expect(state.earned.eq(1000)).toBe(true);
    buy(state,0,1); expect(clickGain(state).gt(1)).toBe(true);
  });

  it('研究や転生を済ませた状態には、購入前固定の例外を適用しない', () => {
    const research=createState(0), upgrade=upgrades.find(item=>item.producer===null)!;
    research.upgrades=[upgrade.id]; expect(clickGain(research).eq(balance.clickBase.add(upgrade.clickAdd))).toBe(true);
    research.upgrades=[]; research.prestige.count=1; research.prestige.total=new Decimal(1);
    expect(clickGain(research).eq('1.1')).toBe(true);
  });
  it('10回ささやくと最初の仲間を購入でき、価格が15%上がる', () => {
    const state = createState(0);
    expect(buy(state, 0, 1)).toBe(false);
    for (let i = 0; i < 10; i++) whisper(state);
    expect(state.currency.gte(10)).toBe(true);
    const before = state.currency;
    expect(buy(state, 0, 1)).toBe(true);
    expect(state.currency.eq(before.sub(10))).toBe(true);
    expect(state.earned.eq(before)).toBe(true);
    expect(cost(state, 0).toNumber()).toBeCloseTo(11.5);
    const afterPurchase = state.currency, rate = production(state);
    advance(state, 5);
    expect(state.currency.sub(afterPurchase).toNumber()).toBeCloseTo(rate.mul(5).toNumber());
  });

  it('前の生産者の所有と累計獲得量で段階的に解放する', () => {
    const state = createState(0);
    state.currency = state.earned = new Decimal(1000);
    expect(unlocked(state, 1)).toBe(false);
    expect(buy(state, 1, 1)).toBe(false);
    buy(state, 0, 1);
    expect(unlocked(state, 1)).toBe(true);
    expect(unlocked(state, 2)).toBe(false);
    buy(state, 1, 1);
    expect(unlocked(state, 2)).toBe(true);
    expect(buy(state, 2, 1)).toBe(true);
  });

  it('隣接シナジーと生産量の1%のクリック補助を適用する', () => {
    const state = createState(0);
    state.owned.splice(0, 3, 10, 2, 1);
    const rate = 10 * 0.2 * 1.02 + 2 * 1.5 * 1.01 + 12;
    expect(production(state).toNumber()).toBeCloseTo(rate);
    expect(clickGain(state).toNumber()).toBeCloseTo(1 + rate * 0.01);
    state.owned.splice(0, 3, 1, 100, 0);
    expect(production(state).toNumber()).toBeCloseTo(150.3);
  });

  it('一括購入価格は逐次購入の合計と一致し、不足時は一部を買わない', () => {
    const state = createState(0);
    let sequential = new Decimal(0);
    for (let i = 0; i < 10; i++) { state.owned[0] = i; sequential = sequential.add(cost(state, 0)); }
    state.owned[0] = 0;
    expect(cost(state, 0, 10).toNumber()).toBeCloseTo(sequential.toNumber(), 8);
    state.currency = state.earned = cost(state, 0, 10);
    expect(buy(state, 0, 100)).toBe(false);
    expect(buy(state, 0, 10)).toBe(true);
    expect(state.owned[0]).toBe(10);
    expect(state.currency.gte(0)).toBe(true);
  });

  it('最大購入は境界で買いすぎず、購入後も次の1個には届かない', () => {
    const state = createState(0);
    state.currency = state.earned = cost(state, 0, 100).mul('1.00000001');
    expect(purchaseQuantity(state, 0, 'max')).toBe(100);
    expect(buy(state, 0, 'max')).toBe(true);
    expect(state.currency.gte(0)).toBe(true);
    expect(purchaseQuantity(state, 0, 'max')).toBe(0);
    expect(buy(state, -1, 1)).toBe(false);
  });

  it('numberの限界を超えても有限の伝聞・価格を計算する', () => {
    const state = createState(0);
    state.currency = state.earned = new Decimal('1e5000');
    expect(buy(state, 0, 'max')).toBe(true);
    expect(state.owned[0]).toBeGreaterThan(80_000);
    expect(state.currency.isFinite()).toBe(true);
    expect(cost(state, 0).isFinite()).toBe(true);
  });
});

describe('時間の進行', () => {
  it('50ms刻みで進み、端数は次のフレームへ持ち越す', () => {
    const state = createState(1000);
    state.owned[0] = 1;
    tickTo(state, 1123);
    expect(state.lastUpdatedAt).toBe(1100);
    expect(state.currency.toNumber()).toBeCloseTo(0.0201, 6);
    tickTo(state, 1150);
    expect(state.currency.toNumber()).toBeCloseTo(0.03015, 6);
  });

  it('長い不在は8時間まで一括処理し、繰り返しても再付与しない', () => {
    const state = createState(0);
    state.owned[0] = 1;
    const now = balance.offlineCapMs * 2;
    expect(catchUp(state, now).toNumber()).toBeGreaterThanOrEqual(5760);
    expect(state.lastOffline.seconds).toBe(8 * 60 * 60);
    expect(state.lastOffline.capped).toBe(true);
    expect(catchUp(state, now).eq(0)).toBe(true);
    expect(state.lastUpdatedAt).toBe(now);
  });

  it('未来時刻では報酬を与えず、負の経過時間を拒否する', () => {
    const state = createState(1000);
    state.owned[0] = 1;
    expect(catchUp(state, 500).eq(0)).toBe(true);
    expect(() => advance(state, -1)).toThrow();
  });

  it('長いフレームと固定ステップで同じ量を得る', () => {
    const a = createState(0), b = createState(0);
    a.owned.splice(0, 3, 10, 3, 1); b.owned.splice(0, 3, 10, 3, 1);
    for (let t = 50; t <= 10_000; t += 50) tickTo(a, t);
    tickTo(b, 10_000);
    expect(a.currency.toNumber()).toBeCloseTo(b.currency.toNumber(), 8);
  });
});

it('毎秒2クリックの5分間で3種を購入し、60秒以内に3種目が見える', () => {
  const state = createState(0);
  let firstPurchase = -1, thirdReveal = -1;
  for (let tick = 1; tick <= 6000; tick++) {
    tickTo(state, tick * 50);
    if (tick % 10 === 0) whisper(state);
    if (unlocked(state, 2) && thirdReveal < 0) thirdReveal = tick * 0.05;
    // First establish each route, then reinvest in the first route.
    const index = state.owned.findIndex(count => count === 0);
    if (buy(state, index < 0 ? 0 : index, 1) && firstPurchase < 0) firstPurchase = tick * 0.05;
  }
  expect(firstPurchase).toBeLessThanOrEqual(10);
  expect(thirdReveal).toBeGreaterThan(0);
  expect(thirdReveal).toBeLessThanOrEqual(60);
  expect(state.owned.slice(0, 3).every(count => count > 0)).toBe(true);
  expect(state.earned.gt(1000)).toBe(true);
  expect(state.currency.gte(0)).toBe(true);
  console.info({ firstPurchase, thirdReveal, owned: state.owned, earned: state.earned.toString() });
});
