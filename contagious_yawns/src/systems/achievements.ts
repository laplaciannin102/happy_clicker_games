import {
  ACHIEVEMENTS,
  ACHIEVEMENT_BY_ID,
  type AchievementCondition,
} from '../data/achievements';
import { PRODUCERS } from '../data/producers';
import type { GameState } from '../state/gameState';
import { totalRate } from './production';

export function totalOwned(state: GameState): number {
  return PRODUCERS.reduce((sum, def) => sum + state.producers[def.id].bought, 0);
}

/** 状態から判定できる条件を満たしているか（'event' は常に false）。 */
export function conditionMet(state: GameState, condition: AchievementCondition): boolean {
  switch (condition.kind) {
    case 'lifetimeYawns':
      return state.lifetime.yawns.gte(condition.amount);
    case 'rate':
      return totalRate(state).gte(condition.amount);
    case 'lifetimeClicks':
      return state.lifetime.clicks >= condition.count;
    case 'owned':
      return state.producers[condition.target].bought >= condition.count;
    case 'ownedTotal':
      return totalOwned(state) >= condition.count;
    case 'upgrades':
      return state.upgrades.size >= condition.count;
    case 'lifetimeStars':
      return state.lifetime.stars >= condition.count;
    case 'prestigeCount':
      return state.prestige.count >= condition.count;
    case 'challenges':
      return state.challenges.completed.size >= condition.count;
    case 'hibernationCount':
      return state.hibernation.count >= condition.count;
    case 'sheepPlays':
      return state.minigames.sheepPlays >= condition.count;
    case 'sheepCollection':
      return state.minigames.collection.size >= condition.count;
    case 'lotteryPlays':
      return state.minigames.lottery.plays >= condition.count;
    case 'lotteryJackpots':
      return state.minigames.lottery.jackpots >= condition.count;
    case 'encore':
      return state.prestige.encore >= condition.level;
    case 'awakened':
      return state.awakenedAt !== null;
    case 'event':
      return false;
  }
}

/** 条件を満たした実績を解除し、新しく解除した ID を返す。 */
export function checkAchievements(state: GameState, now: number): string[] {
  const unlocked: string[] = [];
  for (const def of ACHIEVEMENTS) {
    if (state.achievements.has(def.id)) continue;
    if (conditionMet(state, def.condition)) {
      state.achievements.set(def.id, now);
      unlocked.push(def.id);
    }
  }
  return unlocked;
}

/** 操作や時刻で解除する実績（'event'）。新しく解除したら true。 */
export function unlockEventAchievement(state: GameState, id: string, now: number): boolean {
  const def = ACHIEVEMENT_BY_ID.get(id);
  if (!def || def.condition.kind !== 'event' || state.achievements.has(id)) return false;
  state.achievements.set(id, now);
  return true;
}

/**
 * 全期間の記録だけで判定する実績は、転生しても条件を満たし続けるはず。
 * 満たしていないのに解除済みなら、到達記録と矛盾している（SPEC §6.3-2）。
 */
export function inconsistentAchievements(state: GameState): string[] {
  const out: string[] = [];
  for (const id of state.achievements.keys()) {
    const condition = ACHIEVEMENT_BY_ID.get(id)?.condition;
    if (!condition) continue;
    const lifetimeOnly =
      condition.kind === 'lifetimeYawns' ||
      condition.kind === 'lifetimeClicks' ||
      condition.kind === 'lifetimeStars' ||
      condition.kind === 'prestigeCount' ||
      condition.kind === 'hibernationCount' ||
      condition.kind === 'challenges' ||
      condition.kind === 'sheepPlays' ||
      condition.kind === 'sheepCollection' ||
      condition.kind === 'lotteryPlays' ||
      condition.kind === 'lotteryJackpots' ||
      condition.kind === 'awakened';
    if (lifetimeOnly && !conditionMet(state, condition)) out.push(id);
  }
  return out;
}
