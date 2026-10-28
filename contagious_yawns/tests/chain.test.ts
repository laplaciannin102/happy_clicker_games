import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { CHAIN } from '../src/data/economy';
import { decodeSave, encodeSave } from '../src/save/codec';
import { checkIntegrity } from '../src/save/integrity';
import { migrate } from '../src/save/migrations';
import { createInitialState, type GameState } from '../src/state/gameState';
import { ownedCount, spreadSleepiness } from '../src/systems/chain';
import { applyOffline } from '../src/systems/offline';
import { doPrestige } from '../src/systems/prestige';
import { produce, producerRate, rateEach } from '../src/systems/production';
import { bulkCost, unitPrice } from '../src/systems/purchase';
import { PRODUCER_BY_ID } from '../src/data/producers';
import { playedState } from './helpers';

function withChain(): GameState {
  const s = createInitialState(0, 1);
  s.prestige.nodes.add('chain');
  return s;
}

describe('眠気の連鎖', () => {
  it('解放前はうつらない', () => {
    const s = createInitialState(0, 1);
    s.producers.lecture.bought = 10;
    spreadSleepiness(s, 100);
    expect(s.producers.cat.infected.toNumber()).toBe(0);
  });

  it('生産者 #k は #k-1 を「持っている数 × rate」体うつす。いちばん下はうつさない', () => {
    const s = withChain();
    s.producers.lecture.bought = 10;
    s.producers.cat.bought = 5;
    spreadSleepiness(s, 10);
    expect(s.producers.cat.infected.toNumber()).toBeCloseTo(10 * CHAIN.rate * 10);
    expect(s.producers.lecture.infected.toNumber()).toBe(0);
  });

  it('うつった仲間もうつす（順番に依存しない：進める前の数で計算）', () => {
    const s = withChain();
    s.producers.meeting.bought = 100;
    spreadSleepiness(s, 1);
    expect(s.producers.lecture.infected.toNumber()).toBeCloseTo(100 * CHAIN.rate);
    expect(s.producers.cat.infected.toNumber()).toBe(0);
    spreadSleepiness(s, 1);
    expect(s.producers.cat.infected.toNumber()).toBeCloseTo(100 * CHAIN.rate * CHAIN.rate);
  });

  it('生産量には数えるが、価格には数えない', () => {
    const s = withChain();
    s.producers.cat.bought = 2;
    s.producers.cat.infected = new Decimal(8);
    expect(ownedCount(s, 'cat').toNumber()).toBe(10);
    expect(producerRate(s, 'cat').toNumber()).toBeCloseTo(rateEach(s, 'cat').toNumber() * 10);
    expect(unitPrice(PRODUCER_BY_ID.cat, s.producers.cat.bought).toNumber()).toBeCloseTo(10 * 1.15 ** 2);
    expect(bulkCost(PRODUCER_BY_ID.cat, 2, 1).toNumber()).toBeCloseTo(10 * 1.15 ** 2);
  });

  it('produce とオフラインでも進み、おやすみで消える', () => {
    const s = withChain();
    s.producers.lecture.bought = 10;
    produce(s, 5);
    expect(s.producers.cat.infected.toNumber()).toBeCloseTo(10 * CHAIN.rate * 5);
    applyOffline(s, 60_000);
    expect(s.producers.cat.infected.toNumber()).toBeGreaterThan(1);
    s.totalYawns = new Decimal(1e9);
    doPrestige(s);
    expect(s.producers.cat.infected.toNumber()).toBe(0);
  });
});

describe('セーブと整合性チェック', () => {
  it('うつった数は往復で保たれる（巨大数も）', async () => {
    const s = withChain();
    s.producers.cat.infected = new Decimal('1.5e320');
    const back = await decodeSave(await encodeSave(s), { allowLegacyJson: false });
    expect(back.ok && back.value.state.producers.cat.infected.eq(s.producers.cat.infected)).toBe(true);
  });

  it('v7 → v8：うつった数 0 が足される', () => {
    expect(migrate({ producers: { cat: { bought: 3 } } }, 7)).toMatchObject({ producers: { cat: { bought: 3, infected: '0' } } });
  });

  it('プレイ時間に対してうつった数が多すぎると検出', () => {
    const s = playedState();
    s.prestige.nodes.add('chain');
    s.producers.cat.infected = new Decimal(1);
    expect(checkIntegrity(s, Date.now())).not.toContain('chainTooFast');
    s.producers.cat.infected = new Decimal(1e9);
    expect(checkIntegrity(s, Date.now())).toContain('chainTooFast');
  });
});
