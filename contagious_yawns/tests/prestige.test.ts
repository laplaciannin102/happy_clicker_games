import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { DREAM_NODES, PRESTIGE } from '../src/data/prestige';
import { decodeSave, encodeSave } from '../src/save/codec';
import { checkIntegrity } from '../src/save/integrity';
import { createInitialState, type GameState } from '../src/state/gameState';
import { createAutomation } from '../src/systems/automation';
import { clickValue } from '../src/systems/click';
import { buyNode, nodeStatus } from '../src/systems/dreamTree';
import { applyOffline, offlineCapMs, offlineEfficiency } from '../src/systems/offline';
import { canPrestige, doPrestige, dreamUnlocked, shardsFor, shardsForRun } from '../src/systems/prestige';
import { rateEach } from '../src/systems/production';
import { dreamNodeDesc, dreamNodeName } from '../src/ui/dreamText';
import { playedState } from './helpers';

const fresh = (): GameState => createInitialState(0, 1);

/** おやすみできる状態（累計＝条件ちょうど） */
function ready(): GameState {
  const s = playedState();
  s.totalYawns = new Decimal(PRESTIGE.minTotal);
  s.lifetime.yawns = s.totalYawns;
  return s;
}

describe('夢のかけらの式', () => {
  it('条件未満は 0、条件ちょうどで 10、10倍で 40、100倍で 90', () => {
    expect(shardsFor(new Decimal(PRESTIGE.minTotal * 0.99), 1)).toBe(0);
    expect(shardsFor(new Decimal(PRESTIGE.minTotal), 1)).toBe(10);
    expect(shardsFor(new Decimal(PRESTIGE.minTotal * 10), 1)).toBe(40);
    expect(shardsFor(new Decimal(PRESTIGE.minTotal * 100), 1)).toBe(90);
    expect(shardsFor(new Decimal(PRESTIGE.minTotal), 1.5)).toBe(15);
  });

  it('巨大な累計でも安全な整数に収まる', () => {
    expect(Number.isSafeInteger(shardsFor(new Decimal('ee30'), 1))).toBe(true);
  });

  it('夢タブは条件の10%で予告', () => {
    const s = fresh();
    expect(dreamUnlocked(s)).toBe(false);
    s.totalYawns = new Decimal(PRESTIGE.minTotal * PRESTIGE.teaserRatio);
    expect(dreamUnlocked(s)).toBe(true);
  });
});

describe('おやすみ', () => {
  it('かけらを得て、周回の進行がリセットされ、残すものは残る', () => {
    const s = ready();
    s.upgrades.add('cat_t1');
    s.buffs.push({ kind: 'production', factor: 7, remainingMs: 1000, source: 'wish' });
    const lifetimeClicks = s.lifetime.clicks;
    const achievements = s.achievements.size;

    expect(doPrestige(s)).toBe(10);
    expect(s.prestige).toMatchObject({ shards: 10, shardsLifetime: 10, count: 1 });
    expect(s.yawns.toNumber()).toBe(0);
    expect(s.totalYawns.toNumber()).toBe(0);
    expect(s.clicks).toBe(0);
    expect(s.producers.cat.bought).toBe(0);
    expect(s.upgrades.size).toBe(0);
    expect(s.buffs).toEqual([]);
    expect(s.playTimeMs).toBe(0);
    expect(s.lifetime.clicks).toBe(lifetimeClicks);
    expect(s.achievements.size).toBe(achievements);
  });

  it('条件に届いていなければ何もしない', () => {
    const s = playedState();
    expect(canPrestige(s)).toBe(false);
    expect(doPrestige(s)).toBe(0);
    expect(s.producers.cat.bought).toBe(12);
  });

  it('受動ボーナス：全生産 × (1 + √累計のかけら × 10%)', () => {
    const s = fresh();
    const base = rateEach(s, 'cat').toNumber();
    s.prestige.shardsLifetime = 100;
    expect(rateEach(s, 'cat').toNumber()).toBeCloseTo(base * 2);
    s.prestige.shardsLifetime = 400;
    expect(rateEach(s, 'cat').toNumber()).toBeCloseTo(base * 3);
    // 眠りの達人で係数が 2 倍
    s.prestige.nodes.add('m8');
    expect(rateEach(s, 'cat').toNumber()).toBeCloseTo(base * 5);
  });
});

describe('夢ツリー', () => {
  it('ID は重複せず、前提はすべて存在し、すべてに名前と説明がある', () => {
    const ids = new Set(DREAM_NODES.map((n) => n.id));
    expect(ids.size).toBe(DREAM_NODES.length);
    for (const n of DREAM_NODES) {
      for (const r of n.requires) expect(ids.has(r)).toBe(true);
      expect(dreamNodeName(n)).not.toBe(n.id);
      expect(dreamNodeDesc(n, 'ja')).not.toBe('');
    }
  });

  it('入口から全部たどれる（前提が循環していない）', () => {
    const s = fresh();
    s.prestige.shards = 1e9;
    for (let i = 0; i < DREAM_NODES.length; i++) {
      for (const n of DREAM_NODES) if (nodeStatus(s, n) === 'available') buyNode(s, n.id);
    }
    expect(s.prestige.nodes.size).toBe(DREAM_NODES.length);
  });

  it('前提が足りない・かけらが足りないと解放できない', () => {
    const s = fresh();
    s.prestige.shards = 100;
    expect(buyNode(s, 'm1')).toBe(false);
    expect(buyNode(s, 'root')).toBe(true);
    expect(s.prestige.shards).toBe(99);
    s.prestige.shards = 1;
    expect(buyNode(s, 'm1')).toBe(false);
  });

  it('おやすみのあと：猫・授業・あくびを持って始め、クリック強化を持ち越す', () => {
    const s = ready();
    for (const id of ['root', 'm1', 'm2', 'm3', 'm6', 'n1', 'n3', 'n5']) s.prestige.nodes.add(id);
    s.upgrades.add('click_1');
    s.upgrades.add('cat_t1');
    doPrestige(s);
    expect(s.producers.cat.bought).toBe(10);
    expect(s.producers.lecture.bought).toBe(5);
    expect(s.yawns.toNumber()).toBe(1e4);
    expect([...s.upgrades]).toEqual(['click_1']);
  });

  it('クリック倍率と、オフラインの上限・効率', () => {
    const s = fresh();
    s.prestige.nodes = new Set(['root', 'n1', 'd1', 'd2', 'd4', 'd3', 'd5', 'd6', 'd7']);
    expect(clickValue(s).toNumber()).toBe(3);
    expect(offlineCapMs(s)).toBe(12 * 60 * 60_000);
    expect(offlineEfficiency(s)).toBe(1);
    s.producers.cat.bought = 10;
    const r = applyOffline(s, 60_000);
    expect(r.gained.toNumber()).toBeCloseTo(rateEach(s, 'cat').toNumber() * 10 * 60);
  });

  it('自動購入：対象の生産者を1秒に1体ずつ。OFF にすれば買わない', () => {
    const s = fresh();
    s.prestige.nodes = new Set(['root', 'n1', 'n2']);
    s.yawns = new Decimal(1e6);
    s.totalYawns = s.yawns;
    s.producers.cat.bought = 1;
    const auto = createAutomation();
    auto.tick(s, 999);
    expect(s.producers.cat.bought).toBe(1);
    auto.tick(s, 1);
    expect(s.producers.cat.bought).toBe(2);
    expect(s.producers.lecture.bought).toBe(1);
    expect(s.producers.meeting.bought).toBe(0);
    s.settings.autoBuy = false;
    auto.tick(s, 1000);
    expect(s.producers.cat.bought).toBe(2);
  });

  it('自動アップグレード：いちばん安いものを1つ', () => {
    const s = fresh();
    s.prestige.nodes = new Set(['n7']);
    s.yawns = new Decimal(1e6);
    s.producers.cat.bought = 10;
    s.clicks = 30;
    const result = createAutomation().tick(s, 1000);
    expect(result.upgrades).toEqual(['click_1']);
  });
});

describe('セーブと整合性チェック', () => {
  it('おやすみの状態は往復で保たれる', async () => {
    const s = ready();
    doPrestige(s);
    buyNode(s, 'root');
    s.settings.autoBuy = false;
    const back = await decodeSave(await encodeSave(s), { allowLegacyJson: false });
    expect(back.ok && back.value.state.prestige).toEqual(s.prestige);
    expect(back.ok && back.value.state.settings.autoBuy).toBe(false);
  });

  it('おやすみ直後の正しい状態は改造と判定しない（はじめにもらうものも含む）', () => {
    const s = ready();
    for (const n of DREAM_NODES) s.prestige.nodes.add(n.id);
    s.prestige.shardsLifetime = DREAM_NODES.reduce((sum, n) => sum + n.cost, 0);
    s.prestige.count = 30;
    s.lifetime.yawns = new Decimal('1e40');
    s.upgrades.add('click_1');
    doPrestige(s);
    expect(checkIntegrity(s, Date.now())).toEqual([]);
  });

  it('かけらの収支が合わない・多すぎるのを検出', () => {
    const s = ready();
    doPrestige(s);
    s.prestige.shards = 999;
    expect(checkIntegrity(s, Date.now())).toContain('shardMismatch');
    s.prestige.shards = 1e9;
    s.prestige.shardsLifetime = 1e9;
    expect(checkIntegrity(s, Date.now())).toContain('shardsTooMany');
  });
});

it('おやすみ前のかけらの予告', () => {
  const s = ready();
  expect(shardsForRun(s)).toBe(10);
});
