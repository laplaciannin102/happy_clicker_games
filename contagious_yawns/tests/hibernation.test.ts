import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { CHAIN, OFFLINE } from '../src/data/economy';
import { HIBERNATION, WARMTH_SHOP } from '../src/data/hibernation';
import { DREAM_NODES } from '../src/data/prestige';
import { PRODUCER_BY_ID } from '../src/data/producers';
import { STARS } from '../src/data/stars';
import { UPGRADE_BY_ID } from '../src/data/upgrades';
import { decodeSave, encodeSave } from '../src/save/codec';
import { checkIntegrity } from '../src/save/integrity';
import { migrate } from '../src/save/migrations';
import { createInitialState, type GameState } from '../src/state/gameState';
import { chainRate } from '../src/systems/chain';
import { shardsSpent } from '../src/systems/dreamTree';
import {
  buyWarmthItem,
  canHibernate,
  currentSeason,
  doHibernate,
  hibernationUnlocked,
  nextSeason,
  shardsForNextWarmth,
  warmthFor,
  warmthForNow,
} from '../src/systems/hibernation';
import { offlineEfficiency } from '../src/systems/offline';
import { doPrestige } from '../src/systems/prestige';
import { rateEach } from '../src/systems/production';
import { buyProducer, unitPrice } from '../src/systems/purchase';
import { tickStars } from '../src/systems/stars';
import { buyUpgrade, upgradeCost } from '../src/systems/upgrades';
import { playedState } from './helpers';

/** 夢ツリーを全部埋めた（冬眠できる）状態 */
function treeDone(shardsLifetime = 16_000): GameState {
  const s = createInitialState(0, 1);
  for (const n of DREAM_NODES) s.prestige.nodes.add(n.id);
  s.prestige.shardsLifetime = shardsLifetime;
  s.prestige.count = 20;
  return s;
}

/** 季節を指定した状態（冬眠の回数から決まる） */
function inSeason(count: number): GameState {
  const s = createInitialState(0, 1);
  s.hibernation.count = count;
  return s;
}

describe('冬眠', () => {
  it('夢の交差点を解放するまでは冬眠できない', () => {
    const s = createInitialState(0, 1);
    expect(canHibernate(s)).toBe(false);
    expect(hibernationUnlocked(s)).toBe(false);
    expect(doHibernate(s)).toBe(0);
    expect(s.hibernation.count).toBe(0);
    s.prestige.nodes.add(HIBERNATION.unlockNode);
    expect(canHibernate(s)).toBe(true);
  });

  it('ぬくもり = floor(√(累計のかけら / 1000))', () => {
    expect(warmthFor(999)).toBe(0);
    expect(warmthFor(1000)).toBe(1);
    expect(warmthFor(16_000)).toBe(4);
    expect(warmthFor(100_000)).toBe(10);
  });

  it('もらえるのは「これまでの最高の水準」を超えたぶんだけ（同じ水準で繰り返しても増えない）', () => {
    const s = treeDone(16_000);
    expect(doHibernate(s)).toBe(4);
    s.prestige.nodes.add(HIBERNATION.unlockNode);
    s.prestige.shardsLifetime = 16_000;
    expect(warmthForNow(s)).toBe(0);
    expect(shardsForNextWarmth(s)).toBe(25_000);
    expect(doHibernate(s)).toBe(0);
    expect(s.hibernation.count).toBe(2);
    s.prestige.nodes.add(HIBERNATION.unlockNode);
    s.prestige.shardsLifetime = 36_000;
    expect(doHibernate(s)).toBe(2);
    expect(s.hibernation.warmthLifetime).toBe(6);
  });

  it('第1層がリセットされ、ぬくもり・回数・実績・全期間の記録・羊図鑑は残る', () => {
    const s = treeDone();
    s.producers.cat.bought = 50;
    s.upgrades.add('cat_t1');
    s.achievements.set('yawns_1', 1);
    s.minigames.collection.add('moon');
    s.lifetime.clicks = 999;
    expect(doHibernate(s)).toBe(4);
    expect(s.hibernation).toMatchObject({ warmth: 4, warmthLifetime: 4, count: 1 });
    expect(s.prestige).toMatchObject({ shards: 0, shardsLifetime: 0, count: 20 });
    expect(s.prestige.nodes.size).toBe(0);
    expect(s.producers.cat.bought).toBe(0);
    expect(s.upgrades.size).toBe(0);
    expect(s.achievements.has('yawns_1')).toBe(true);
    expect(s.minigames.collection.has('moon')).toBe(true);
    expect(s.lifetime.clicks).toBe(999);
  });

  it('ぬくもり1つにつき全生産 +25%、ショップの倍率も掛かる', () => {
    const s = createInitialState(0, 1);
    const base = rateEach(s, 'cat').toNumber();
    s.hibernation.warmthLifetime = 4;
    expect(rateEach(s, 'cat').toNumber()).toBeCloseTo(base * 2);
    s.hibernation.warmth = 1;
    expect(buyWarmthItem(s, 'w_production')).toBe(true);
    expect(rateEach(s, 'cat').toNumber()).toBeCloseTo(base * 2 * 3);
  });
});

describe('ぬくもりショップ', () => {
  it('ID は重複せず、残すノードはすべて夢ツリーにある', () => {
    const ids = new Set(DREAM_NODES.map((n) => n.id));
    expect(new Set(WARMTH_SHOP.map((w) => w.id)).size).toBe(WARMTH_SHOP.length);
    for (const w of WARMTH_SHOP) {
      if (w.effect.kind === 'keepNodes') for (const n of w.effect.nodes) expect(ids.has(n)).toBe(true);
    }
  });

  it('買えるのは1回だけ、ぬくもりが足りなければ買えない', () => {
    const s = createInitialState(0, 1);
    s.hibernation.warmth = 1;
    expect(buyWarmthItem(s, 'w_shards')).toBe(false);
    expect(buyWarmthItem(s, 'w_entry')).toBe(true);
    expect(buyWarmthItem(s, 'w_entry')).toBe(false);
    expect(buyWarmthItem(s, 'nope')).toBe(false);
  });

  it('残すノードは買った時点で手に入り、冬眠しても残る。払っていないので「使った額」に入らない', () => {
    const s = treeDone();
    doHibernate(s);
    s.hibernation.warmth = 10;
    buyWarmthItem(s, 'w_entry');
    buyWarmthItem(s, 'w_chain');
    expect([...s.prestige.nodes].sort()).toEqual(['chain', 'd1', 'm1', 'm4', 'm5', 'n1', 'root']);
    expect(shardsSpent(s)).toBe(0);
    s.prestige.nodes.add('cross');
    doHibernate(s);
    expect([...s.prestige.nodes].sort()).toEqual(['chain', 'd1', 'm1', 'm4', 'm5', 'n1', 'root']);
  });

  it('夢見がちな毛布で夢のかけら ×2', () => {
    const s = createInitialState(0, 1);
    s.totalYawns = new Decimal(1.5e8);
    s.hibernation.warmth = 2;
    buyWarmthItem(s, 'w_shards');
    expect(doPrestige(s)).toBe(20);
  });
});

describe('季節', () => {
  it('冬眠前は季節なし。1回目で春、そのあと 夏→秋→冬→春', () => {
    expect(currentSeason(inSeason(0))).toBeNull();
    expect([1, 2, 3, 4, 5].map((c) => currentSeason(inSeason(c)))).toEqual(['spring', 'summer', 'autumn', 'winter', 'spring']);
    expect(nextSeason(inSeason(0))).toBe('spring');
    expect(nextSeason(inSeason(4))).toBe('spring');
  });

  it('春：流れ星の間隔が半分', () => {
    const s = inSeason(1);
    s.stars.timerMs = 0;
    tickStars(s, 1, true);
    expect(s.stars.timerMs).toBeLessThan(STARS.maxIntervalMs * 0.5);
    expect(s.stars.timerMs).toBeGreaterThanOrEqual(STARS.minIntervalMs * 0.5);
  });

  it('夏：おやすみ中の効率 +50%', () => {
    expect(offlineEfficiency(inSeason(2))).toBe(Math.min(1, OFFLINE.efficiency + 0.5));
    expect(offlineEfficiency(inSeason(1))).toBe(OFFLINE.efficiency);
  });

  it('秋：まくら工房が半額', () => {
    const s = inSeason(3);
    const def = UPGRADE_BY_ID.get('click_1')!;
    expect(upgradeCost(s, def).toNumber()).toBe(def.cost / 2);
    s.yawns = new Decimal(def.cost / 2);
    s.clicks = 30;
    expect(buyUpgrade(s, 'click_1')).toBe(true);
    expect(s.yawns.toNumber()).toBe(0);
  });

  it('冬：仲間の値段が2倍、眠気の連鎖が3倍', () => {
    const s = inSeason(4);
    expect(chainRate(s)).toBeCloseTo(CHAIN.rate * 3);
    s.yawns = new Decimal(15);
    expect(buyProducer(s, 'cat', 1)).toBe(0);
    s.yawns = new Decimal(20);
    expect(buyProducer(s, 'cat', 1)).toBe(1);
    expect(unitPrice(PRODUCER_BY_ID.cat, 0, 2).toNumber()).toBe(20);
  });
});

describe('セーブと整合性チェック', () => {
  it('冬眠の状態は往復で保たれる', async () => {
    const s = treeDone();
    doHibernate(s);
    buyWarmthItem(s, 'w_entry');
    const back = await decodeSave(await encodeSave(s), { allowLegacyJson: false });
    expect(back.ok && back.value.state.hibernation).toEqual(s.hibernation);
    expect(back.ok && [...back.value.state.prestige.nodes].sort()).toEqual([...s.prestige.nodes].sort());
  });

  it('v8 → v9：冬眠の状態が足される', () => {
    expect(migrate({}, 8)).toMatchObject({ hibernation: { warmth: 0, warmthLifetime: 0, count: 0, shop: [] } });
  });

  it('冬眠直後・季節つきの正しい状態は改造と判定しない', () => {
    const s = playedState();
    s.prestige.count = 20;
    s.lifetime.yawns = new Decimal('1e40');
    s.prestige.nodes.add('cross');
    doHibernate(s);
    s.hibernation.warmth += 0;
    expect(checkIntegrity(s, Date.now())).toEqual([]);
    // 冬（4回目）に、1分間クリックして稼いだあくびで、冬の値段で猫を買った状態
    s.hibernation.count = 4;
    s.playTimeMs = 60_000;
    s.lifetime.playTimeMs += 60_000;
    s.clicks = 1000;
    s.lifetime.clicks += 1000;
    s.yawns = new Decimal(1000);
    s.totalYawns = new Decimal(1000);
    s.lifetime.yawns = s.lifetime.yawns.add(1000);
    expect(buyProducer(s, 'cat', 10)).toBe(10);
    expect(checkIntegrity(s, Date.now())).toEqual([]);
  });

  it('ぬくもりの収支が合わなければ検出', () => {
    const s = playedState();
    s.hibernation.warmth = 5;
    expect(checkIntegrity(s, Date.now())).toContain('warmthMismatch');
  });
});
