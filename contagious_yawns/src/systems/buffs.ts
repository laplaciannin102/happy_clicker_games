import type { BuffKind, GameState } from '../state/gameState';

/** 一時的な倍率の合計（種類が違う効果が重なったら掛け算）。 */
export function buffMultiplier(state: GameState, kind: BuffKind): number {
  return state.buffs.reduce((m, b) => (b.kind === kind ? m * b.factor : m), 1);
}

/** 一時的な倍率の残り時間を進め、切れたものを消す。オフラインの時間にも使う。 */
export function tickBuffs(state: GameState, dtMs: number): void {
  if (state.buffs.length === 0) return;
  for (const b of state.buffs) b.remainingMs -= dtMs;
  state.buffs = state.buffs.filter((b) => b.remainingMs > 0);
}
