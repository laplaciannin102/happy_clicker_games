import { CHALLENGES } from '../data/challenges';
import { ENDING } from '../data/ending';
import type { GameState } from '../state/gameState';

export const ENDING_REQUIREMENTS = ['challenges', 'hibernations', 'goal'] as const;
export type EndingRequirement = (typeof ENDING_REQUIREMENTS)[number];

export interface EndingProgress {
  id: EndingRequirement;
  met: boolean;
  /** 今の値と目標（表示用） */
  now: number;
  need: number;
}

/** めざめの条件と、それぞれの進み具合（DESIGN.md §6.3）。 */
export function endingProgress(state: GameState): EndingProgress[] {
  const cleared = state.challenges.completed.size;
  const total = state.totalYawns;
  return [
    { id: 'challenges', met: cleared >= CHALLENGES.length, now: cleared, need: CHALLENGES.length },
    { id: 'hibernations', met: state.hibernation.count >= ENDING.hibernations, now: state.hibernation.count, need: ENDING.hibernations },
    { id: 'goal', met: total.gte(ENDING.goal), now: total.toNumber(), need: ENDING.goal },
  ];
}

/** めざめの予告を出すか：一度でも冬眠したか。 */
export function endingVisible(state: GameState): boolean {
  return state.hibernation.count > 0 || state.awakenedAt !== null;
}

export function canAwaken(state: GameState): boolean {
  return state.awakenedAt === null && endingProgress(state).every((r) => r.met);
}

/** めざめる（一度きり）。めざめたら true。 */
export function awaken(state: GameState, now: number): boolean {
  if (!canAwaken(state)) return false;
  state.awakenedAt = now;
  return true;
}

/** めざめたあとの全生産倍率（「朝日」）。 */
export function endingMultiplier(state: GameState): number {
  return state.awakenedAt === null ? 1 : ENDING.productionFactor;
}
