import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { PRODUCERS } from '../src/data/producers';
import { UPGRADES, UPGRADE_BY_ID } from '../src/data/upgrades';
import { createInitialState } from '../src/state/gameState';
import { clickValue } from '../src/systems/click';
import { rateEach, totalRate } from '../src/systems/production';
import { buyUpgrade, upgradeStatus, visibleUpgrades } from '../src/systems/upgrades';
import { upgradeDesc, upgradeName } from '../src/ui/upgradeText';

const fresh = () => createInitialState(0, 1);

describe('アップグレード定義', () => {
  it('ID は重複しない', () => {
    expect(UPGRADE_BY_ID.size).toBe(UPGRADES.length);
  });

  it('生産者ごとに7段の強化がある', () => {
    for (const p of PRODUCERS) {
      expect(UPGRADES.filter((u) => u.effect.kind === 'producer' && u.effect.target === p.id)).toHaveLength(7);
    }
  });

  it('すべてに名前と説明がある（ID がそのまま出ない）', () => {
    for (const u of UPGRADES) {
      expect(upgradeName(u)).not.toBe(u.id);
      expect(upgradeName(u)).not.toBe('');
      expect(upgradeDesc(u)).not.toBe('');
    }
  });
});

describe('解放と購入', () => {
  it('最初は何も見えない', () => {
    expect(visibleUpgrades(fresh())).toEqual([]);
  });

  it('条件の半分で「???」、達成で買える', () => {
    const s = fresh();
    s.producers.cat.bought = 5;
    expect(upgradeStatus(s, UPGRADE_BY_ID.get('cat_t2')!)).toBe('teaser');
    s.producers.cat.bought = 10;
    expect(upgradeStatus(s, UPGRADE_BY_ID.get('cat_t2')!)).toBe('available');
  });

  it('買うとあくびが減り、2回は買えない', () => {
    const s = fresh();
    s.producers.cat.bought = 1;
    s.yawns = new Decimal(100);
    expect(buyUpgrade(s, 'cat_t1')).toBe(true);
    expect(s.yawns.toNumber()).toBe(40);
    expect(buyUpgrade(s, 'cat_t1')).toBe(false);
    expect(upgradeStatus(s, UPGRADE_BY_ID.get('cat_t1')!)).toBe('bought');
  });

  it('条件未達・お金不足・知らない ID では買えない', () => {
    const s = fresh();
    s.yawns = new Decimal(1e9);
    expect(buyUpgrade(s, 'cat_t1')).toBe(false);
    expect(buyUpgrade(s, 'nope')).toBe(false);
    s.producers.cat.bought = 1;
    s.yawns = new Decimal(10);
    expect(buyUpgrade(s, 'cat_t1')).toBe(false);
  });
});

describe('効果', () => {
  it('生産者強化は ×2、全体倍率・シナジーも掛かる', () => {
    const s = fresh();
    s.producers.cat.bought = 20;
    s.producers.kotatsu.bought = 20;
    const base = rateEach(s, 'cat').toNumber();
    s.upgrades.add('cat_t1');
    s.upgrades.add('cat_t2');
    expect(rateEach(s, 'cat').toNumber()).toBeCloseTo(base * 4);
    s.upgrades.add('global_1');
    expect(rateEach(s, 'cat').toNumber()).toBeCloseTo(base * 4 * 1.1);
    s.upgrades.add('synergy_cat_kotatsu');
    expect(rateEach(s, 'cat').toNumber()).toBeCloseTo(base * 4 * 1.1 * 1.5);
    expect(rateEach(s, 'lecture').toNumber()).toBeCloseTo(1 * 1.1);
  });

  it('クリック強化：固定の加算と、毎秒生産の割合', () => {
    const s = fresh();
    s.producers.meeting.bought = 10;
    expect(clickValue(s).toNumber()).toBe(1);
    s.upgrades.add('click_1');
    expect(clickValue(s).toNumber()).toBe(2);
    s.upgrades.add('click_2');
    expect(clickValue(s).toNumber()).toBeCloseTo(2 + totalRate(s).toNumber() * 0.01);
  });
});
