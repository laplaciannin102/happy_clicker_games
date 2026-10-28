import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/state/gameState';
import { performClick } from '../src/systems/click';
import { produce, producerShare, secondsUntil, totalRate } from '../src/systems/production';
import { producerVisibility } from '../src/systems/unlock';

describe('生産', () => {
  it('生産量 = 基本生産 × 所持数 の合計', () => {
    const s = createInitialState(0, 1);
    s.producers.cat.bought = 10;
    s.producers.lecture.bought = 2;
    expect(totalRate(s).toNumber()).toBeCloseTo(3);
    expect(producerShare(s, 'lecture')).toBeCloseTo(2 / 3);
  });

  it('produce は手持ちと累計の両方を増やし、dt を分けても結果が同じ', () => {
    const a = createInitialState(0, 1);
    const b = createInitialState(0, 1);
    a.producers.meeting.bought = 3;
    b.producers.meeting.bought = 3;
    produce(a, 60);
    for (let i = 0; i < 1200; i++) produce(b, 0.05);
    expect(a.yawns.toNumber()).toBeCloseTo(27 * 60, 6);
    expect(b.yawns.toNumber()).toBeCloseTo(27 * 60, 6);
    expect(a.totalYawns.eq(a.yawns)).toBe(true);
    expect(a.playTimeMs).toBeCloseTo(60_000);
  });

  it('0 以下や NaN の dt は無視する', () => {
    const s = createInitialState(0, 1);
    s.producers.cat.bought = 1;
    produce(s, -5);
    produce(s, Number.NaN);
    expect(s.yawns.toNumber()).toBe(0);
  });

  it('クリックで 1 あくび', () => {
    const s = createInitialState(0, 1);
    performClick(s);
    performClick(s);
    expect(s.yawns.toNumber()).toBe(2);
    expect(s.clicks).toBe(2);
  });

  it('あと何秒で買えるか', () => {
    expect(secondsUntil(new Decimal(5), new Decimal(10), new Decimal(1))).toBe(5);
    expect(secondsUntil(new Decimal(10), new Decimal(10), new Decimal(0))).toBe(0);
    expect(secondsUntil(new Decimal(0), new Decimal(10), new Decimal(0))).toBe(Infinity);
  });
});

describe('解放', () => {
  it('最初は猫だけ', () => {
    const v = producerVisibility(createInitialState(0, 1));
    expect(v.cat).toBe('visible');
    expect(Object.entries(v).filter(([id]) => id !== 'cat').every(([, s]) => s === 'hidden')).toBe(true);
  });

  it('猫を持つと次が「???」、累計が半額に達すると表示', () => {
    const s = createInitialState(0, 1);
    s.producers.cat.bought = 1;
    s.totalYawns = new Decimal(59);
    expect(producerVisibility(s).lecture).toBe('teaser');
    s.totalYawns = new Decimal(60);
    expect(producerVisibility(s).lecture).toBe('visible');
    expect(producerVisibility(s).meeting).toBe('hidden');
  });

  it('持っている生産者は常に表示', () => {
    const s = createInitialState(0, 1);
    s.producers.meeting.bought = 1;
    expect(producerVisibility(s).meeting).toBe('visible');
  });
});
