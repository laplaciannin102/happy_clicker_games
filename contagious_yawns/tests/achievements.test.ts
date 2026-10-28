import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, ACHIEVEMENT_BY_ID, HIDDEN_RULES } from '../src/data/achievements';
import { createInitialState } from '../src/state/gameState';
import { checkAchievements, unlockEventAchievement } from '../src/systems/achievements';
import { createActivityTracker } from '../src/systems/activity';
import { performClick } from '../src/systems/click';
import { produce, rateEach } from '../src/systems/production';
import { achievementText } from '../src/ui/achievementText';

const fresh = () => createInitialState(0, 1);

describe('実績の定義', () => {
  it('50個以上、ID の重複なし、隠し実績あり', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(50);
    expect(ACHIEVEMENT_BY_ID.size).toBe(ACHIEVEMENTS.length);
    expect(ACHIEVEMENTS.some((a) => a.hidden)).toBe(true);
  });

  it('すべてに名前と説明がある', () => {
    for (const a of ACHIEVEMENTS) {
      const { name, desc } = achievementText(a, 'ja');
      expect(name).not.toBe(a.id);
      expect(name).not.toBe('');
      expect(desc).not.toBe('');
    }
  });
});

describe('解除', () => {
  it('条件を満たすと解除され、2回は解除されない', () => {
    const s = fresh();
    expect(checkAchievements(s, 10)).toEqual([]);
    for (let i = 0; i < 100; i++) performClick(s);
    const first = checkAchievements(s, 20);
    expect(first).toContain('yawns_1');
    expect(first).toContain('clicks_1');
    expect(s.achievements.get('yawns_1')).toBe(20);
    expect(checkAchievements(s, 30)).toEqual([]);
  });

  it('生産者・合計所持数・毎秒の実績', () => {
    const s = fresh();
    s.producers.cat.bought = 100;
    s.producers.lecture.bought = 50;
    const ids = checkAchievements(s, 0);
    expect(ids).toEqual(
      expect.arrayContaining(['producer_cat_1', 'producer_cat_50', 'producer_lecture_50', 'ownedTotal_1', 'cat_lover', 'rate_1']),
    );
  });

  it('実績1個につき全生産 +1%', () => {
    const s = fresh();
    const base = rateEach(s, 'cat').toNumber();
    s.achievements.set('yawns_1', 0);
    s.achievements.set('yawns_2', 0);
    expect(rateEach(s, 'cat').toNumber()).toBeCloseTo(base * 1.02);
  });

  it('全期間の記録は周回の値と一緒に増える', () => {
    const s = fresh();
    s.producers.cat.bought = 10;
    performClick(s);
    produce(s, 10);
    expect(s.lifetime.clicks).toBe(1);
    expect(s.lifetime.yawns.eq(s.totalYawns)).toBe(true);
    expect(s.lifetime.playTimeMs).toBe(10_000);
  });

  it('イベント実績はコードからだけ解除できる', () => {
    const s = fresh();
    expect(unlockEventAchievement(s, 'night_owl', 5)).toBe(true);
    expect(unlockEventAchievement(s, 'night_owl', 6)).toBe(false);
    expect(unlockEventAchievement(s, 'yawns_1', 6)).toBe(false);
    s.lifetime.yawns = new Decimal(1e30);
    expect(checkAchievements(s, 7)).not.toContain('night_owl');
  });
});

describe('隠し実績の記録', () => {
  it('寝落ち：画面を開いたまま操作しない', () => {
    const a = createActivityTracker(0);
    expect(a.poll(HIDDEN_RULES.idleNapMs - 1, true, 12)).toEqual([]);
    expect(a.poll(HIDDEN_RULES.idleNapMs, false, 12)).toEqual([]);
    expect(a.poll(HIDDEN_RULES.idleNapMs, true, 12)).toEqual(['idle_nap']);
    a.input(HIDDEN_RULES.idleNapMs);
    expect(a.poll(HIDDEN_RULES.idleNapMs + 1000, true, 12)).toEqual([]);
  });

  it('夜更かし：午前2〜4時', () => {
    const a = createActivityTracker(0);
    expect(a.poll(0, true, 1)).toEqual([]);
    expect(a.poll(0, true, 2)).toEqual(['night_owl']);
    expect(a.poll(0, true, 4)).toEqual([]);
  });

  it('早口：1秒間に15回', () => {
    const slow = createActivityTracker(0);
    for (let i = 0; i < 15; i++) slow.click(i * 100);
    expect(slow.poll(1500, true, 12)).toEqual([]);
    const fast = createActivityTracker(0);
    for (let i = 0; i < 15; i++) fast.click(i * 60);
    expect(fast.poll(900, true, 12)).toContain('fast_yawner');
  });

  it('寝る子は育つ：8時間以上はなれる', () => {
    const a = createActivityTracker(0);
    a.away(HIDDEN_RULES.longSleepMs - 1);
    expect(a.poll(0, true, 12)).toEqual([]);
    a.away(HIDDEN_RULES.longSleepMs);
    expect(a.poll(0, true, 12)).toEqual(['long_sleep']);
  });
});
