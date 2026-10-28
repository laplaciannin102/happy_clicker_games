import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { PRODUCER_BY_ID } from '../src/data/producers';
import { createInitialState } from '../src/state/gameState';
import { bulkCost, buyProducer, maxAffordable, unitPrice } from '../src/systems/purchase';

const cat = PRODUCER_BY_ID.cat;

describe('価格', () => {
  it('基本価格 × 1.15^所持数', () => {
    expect(unitPrice(cat, 0).toNumber()).toBeCloseTo(10);
    expect(unitPrice(cat, 1).toNumber()).toBeCloseTo(11.5);
    expect(unitPrice(cat, 10).toNumber()).toBeCloseTo(10 * 1.15 ** 10);
  });

  it('まとめ買いの価格は1体ずつの合計と一致する', () => {
    for (const owned of [0, 3, 25]) {
      let sum = 0;
      for (let i = 0; i < 10; i++) sum += 10 * 1.15 ** (owned + i);
      expect(bulkCost(cat, owned, 10).toNumber()).toBeCloseTo(sum, 6);
    }
    expect(bulkCost(cat, 5, 0).toNumber()).toBe(0);
  });

  it('最大購入数は「買える」かつ「もう1体は買えない」', () => {
    for (const money of [0, 9.99, 10, 21.5, 100, 12345, 1e9]) {
      for (const owned of [0, 7, 40]) {
        const m = new Decimal(money);
        const n = maxAffordable(cat, owned, m);
        expect(bulkCost(cat, owned, n).lte(m)).toBe(true);
        expect(bulkCost(cat, owned, n + 1).gt(m)).toBe(true);
      }
    }
  });

  it('巨大な所持金でも計算できる', () => {
    const n = maxAffordable(cat, 0, new Decimal('1e400'));
    expect(n).toBeGreaterThan(6000);
    expect(bulkCost(cat, 0, n).lte(new Decimal('1e400'))).toBe(true);
  });
});

describe('購入', () => {
  it('買うとあくびが減り、所持数が増える', () => {
    const s = createInitialState(0, 1);
    s.yawns = new Decimal(25);
    expect(buyProducer(s, 'cat', 1)).toBe(1);
    expect(s.producers.cat.bought).toBe(1);
    expect(s.yawns.toNumber()).toBeCloseTo(15);
  });

  it('足りなければ何も変わらない', () => {
    const s = createInitialState(0, 1);
    s.yawns = new Decimal(50);
    expect(buyProducer(s, 'cat', 10)).toBe(0);
    expect(buyProducer(s, 'lecture', 'max')).toBe(0);
    expect(s.yawns.toNumber()).toBe(50);
    expect(s.producers.cat.bought).toBe(0);
  });

  it('最大で買える分だけ買う', () => {
    const s = createInitialState(0, 1);
    s.yawns = new Decimal(100);
    const n = buyProducer(s, 'cat', 'max');
    expect(n).toBe(maxAffordable(cat, 0, new Decimal(100)));
    expect(s.yawns.gte(0)).toBe(true);
    expect(s.yawns.lt(unitPrice(cat, n))).toBe(true);
  });
});
