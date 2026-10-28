import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { CHALLENGES } from '../src/data/challenges';
import { ENDING } from '../src/data/ending';
import { ENCORE } from '../src/data/prestige';
import { decodeSave, encodeSave } from '../src/save/codec';
import { checkIntegrity } from '../src/save/integrity';
import { checkAchievements } from '../src/systems/achievements';
import {
  buyEncore,
  dreamProductionMultiplier,
  encoreAvailable,
  encoreCost,
  encoreSpent,
  shardsSpent,
} from '../src/systems/dreamTree';
import { awaken, canAwaken, endingMultiplier, endingProgress } from '../src/systems/ending';
import { doHibernate } from '../src/systems/hibernation';
import { playedState } from './helpers';

describe('夢の続き', () => {
  it('夢の交差点のあとで解放でき、値段は段階ごとに上がる', () => {
    const s = playedState();
    s.prestige.shards = 1e6;
    s.prestige.shardsLifetime = 1e6;
    expect(encoreAvailable(s)).toBe(false);
    expect(buyEncore(s)).toBe(false);
    s.prestige.nodes.add(ENCORE.requires);
    const before = dreamProductionMultiplier(s);
    expect(buyEncore(s)).toBe(true);
    expect(buyEncore(s)).toBe(true);
    expect(s.prestige.encore).toBe(2);
    expect(s.prestige.shards).toBe(1e6 - ENCORE.baseCost - ENCORE.baseCost * ENCORE.costGrowth);
    expect(encoreSpent(2)).toBe(ENCORE.baseCost + encoreCost(1));
    expect(dreamProductionMultiplier(s) / before).toBeCloseTo(ENCORE.factor ** 2);
  });

  it('使ったかけらは収支に入り、冬眠すると最初からになる', () => {
    const s = playedState();
    s.prestige.count = 30;
    s.lifetime.yawns = new Decimal('1e40');
    s.prestige.nodes.add('cross');
    s.prestige.shards = 50_000;
    s.prestige.shardsLifetime = 50_000 + shardsSpent(s);
    buyEncore(s);
    expect(checkIntegrity(s, Date.now())).not.toContain('shardMismatch');
    doHibernate(s);
    expect(s.prestige.encore).toBe(0);
  });

  it('5段階で実績', () => {
    const s = playedState();
    s.prestige.encore = 5;
    expect(checkAchievements(s, 0)).toContain('ending_encore');
  });
});

describe('めざめ（エンディング）', () => {
  function ready(): ReturnType<typeof playedState> {
    const s = playedState();
    for (const c of CHALLENGES) s.challenges.completed.add(c.id);
    s.hibernation.count = ENDING.hibernations;
    s.totalYawns = new Decimal(ENDING.goal);
    return s;
  }

  it('3つの条件がすべてそろうとめざめられる。一度きり', () => {
    const s = ready();
    expect(endingProgress(s).every((r) => r.met)).toBe(true);
    s.hibernation.count -= 1;
    expect(canAwaken(s)).toBe(false);
    s.hibernation.count += 1;
    s.challenges.completed.delete(CHALLENGES[0]?.id ?? '');
    expect(canAwaken(s)).toBe(false);
    const t = ready();
    t.totalYawns = new Decimal(ENDING.goal / 10);
    expect(canAwaken(t)).toBe(false);

    const u = ready();
    expect(endingMultiplier(u)).toBe(1);
    expect(awaken(u, 123)).toBe(true);
    expect(u.awakenedAt).toBe(123);
    expect(awaken(u, 456)).toBe(false);
    expect(endingMultiplier(u)).toBe(ENDING.productionFactor);
    expect(checkAchievements(u, 0)).toContain('ending_awaken');
  });

  it('めざめた記録は往復で保たれ、条件を満たさずにめざめていたら検出', async () => {
    const s = ready();
    awaken(s, 1_700_000_000_000);
    const back = await decodeSave(await encodeSave(s), { allowLegacyJson: false });
    expect(back.ok && back.value.state.awakenedAt).toBe(1_700_000_000_000);

    const fake = playedState();
    fake.awakenedAt = 1;
    expect(checkIntegrity(fake, Date.now())).toContain('endingMismatch');
  });
});
