import Decimal from 'break_eternity.js';
import { achievements, type Achievement } from '../data/achievements';
import type { GameState } from '../state/game';

export function eligible(state: GameState, achievement: Achievement): boolean {
  switch (achievement.kind) {
    case 'owned': return new Decimal(state.records.maxOwned[achievement.producer]).gte(achievement.target);
    case 'earned': return state.records.bestRunEarned.gte(achievement.target);
    case 'clicks': return new Decimal(state.clicks).gte(achievement.target);
    case 'time': return new Decimal(state.playSeconds).gte(achievement.target);
    case 'events': return new Decimal(state.events.collected).gte(achievement.target);
    case 'all': return new Decimal(state.records.bestAllOwned).gte(achievement.target);
    case 'prestige': return new Decimal(state.prestige.count).gte(achievement.target);
    case 'myth': return new Decimal(state.myth.count).gte(achievement.target);
    case 'challenge': return new Decimal(state.challenge.completed.length).gte(achievement.target);
  }
}

export function grantAchievements(state: GameState): string[] {
  state.records.maxOwned = state.records.maxOwned.map((record, index) => Math.max(record, state.owned[index]));
  state.records.bestRunEarned = Decimal.max(state.records.bestRunEarned, state.earned);
  state.records.bestAllOwned = Math.max(state.records.bestAllOwned, Math.min(...state.owned));
  const added: string[] = [];
  for (const achievement of achievements) {
    if (!state.achievements.includes(achievement.id) && eligible(state, achievement)) {
      state.achievements.push(achievement.id); added.push(achievement.id);
    }
  }
  return added;
}

export function nextMilestone(state: GameState, rate: Decimal, remaining: number) {
  let seconds = remaining;
  let earned: Decimal | undefined;
  let playSeconds: number | undefined;
  for (const achievement of achievements) {
    if (state.achievements.includes(achievement.id)) continue;
    if (achievement.kind === 'earned' && rate.gt(0) && achievement.target.gt(state.earned)) {
      const until = achievement.target.sub(state.earned).div(rate).toNumber();
      if (until > 0 && until < seconds) { seconds = until; earned = achievement.target; playSeconds = undefined; }
    }
    if (achievement.kind === 'time' && achievement.target.gt(state.playSeconds)) {
      const until = achievement.target.toNumber() - state.playSeconds;
      if (until > 0 && until < seconds) { seconds = until; playSeconds = achievement.target.toNumber(); earned = undefined; }
    }
  }
  return { seconds, earned, playSeconds };
}
