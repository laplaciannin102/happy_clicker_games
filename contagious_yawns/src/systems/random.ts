import { mulberry32 } from '../core/rng';
import type { GameState } from '../state/gameState';

/** GameState のシードから次の乱数（0 以上 1 未満）を取り出し、シードを進める。 */
export function nextRandom(state: GameState): number {
  const { value, next } = mulberry32(state.rngSeed);
  state.rngSeed = next;
  return value;
}

/** [min, max) の一様乱数。 */
export function randomBetween(state: GameState, min: number, max: number): number {
  return min + (max - min) * nextRandom(state);
}

/** 重みつきで1つ選ぶ。 */
export function pickWeighted<T extends { weight: number }>(state: GameState, items: readonly T[]): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let r = nextRandom(state) * total;
  for (const item of items) {
    r -= item.weight;
    if (r < 0) return item;
  }
  const last = items[items.length - 1];
  if (last === undefined) throw new Error('pickWeighted: empty list');
  return last;
}
