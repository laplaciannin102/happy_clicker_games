import Decimal from 'break_eternity.js';
import { mythBalance, challengeIds, type ChallengeId } from '../data/myth';
import type { GameState } from '../state/game';
import { createRunState } from './prestige';
import { grantAchievements } from './achievements';

export function canCompileMyth(state: GameState): boolean {
  return !state.challenge.active && state.prestige.total.gte(mythBalance.requirement) &&
    state.earned.gte(mythBalance.runRequirement) && state.myth.count < Number.MAX_SAFE_INTEGER;
}
export function compileMyth(state: GameState, now: number): GameState | null {
  if (!canCompileMyth(state)) return null;
  const next = createRunState(state, now);
  next.myth.count++;
  next.myth.archivedPoints = next.myth.archivedPoints.add(state.prestige.total);
  next.myth.archivedPrestiges = state.prestige.count;
  next.prestige = { points: new Decimal(0), total: new Decimal(0), count: state.prestige.count, upgrades: [], lastGain: new Decimal(0) };
  next.owned[0] = next.startingNeighbors = 0;
  grantAchievements(next);
  return next;
}
export function canStartChallenge(state: GameState, id: ChallengeId): boolean {
  return challengeIds.includes(id) && state.myth.count > 0 && !state.challenge.active &&
    (id !== 'silent' || state.prestige.upgrades.includes('inheritance'));
}
export function startChallenge(state: GameState, id: ChallengeId, now: number): GameState | null {
  if (!canStartChallenge(state, id)) return null;
  const next = createRunState(state, now); next.challenge.active = id; return next;
}
export function leaveChallenge(state: GameState, now: number, complete = false): GameState | null {
  const id = state.challenge.active;
  if (!id || (complete && state.earned.lt(mythBalance.challengeGoal))) return null;
  const next = createRunState(state, now); next.challenge.active = null;
  // The agreed 1e7 challenge goal is below the normal 1e17 prestige threshold: no lore payout.
  if (complete && !next.challenge.completed.includes(id)) next.challenge.completed.push(id);
  grantAchievements(next);
  return next;
}
