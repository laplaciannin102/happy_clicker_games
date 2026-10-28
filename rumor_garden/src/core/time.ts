import Decimal from 'break_eternity.js';
import { balance } from '../data/balance';
import type { GameState } from '../state/game';
import { advanceWorld } from './progression';

export function catchUp(state: GameState, now: number): Decimal {
  const actual = Math.max(0, now - state.lastUpdatedAt);
  const elapsed = Math.min(actual, balance.offlineCapMs);
  const before = [...state.generated];
  const gained = advanceWorld(state, elapsed / 1000, false);
  finishCatchUp(state, now, actual, elapsed, gained, before);
  return gained;
}

export function finishCatchUp(state: GameState, now: number, actual: number, elapsed: number, gained: Decimal, before: Decimal[]): void {
  state.lastOfflineGenerated = state.generated.map((value, i) => Decimal.max(0, value.sub(before[i])));
  state.events.visible = 0;
  if (actual > elapsed) { state.events.boost = 0; state.tale.boost = 0; }
  if (actual > 0) {
    state.offlineSeconds += elapsed / 1000;
    state.offlineEarned = state.offlineEarned.add(gained);
    state.lastOffline = { seconds: elapsed / 1000, gained, capped: actual > elapsed };
  }
  state.lastUpdatedAt = now;
}

export function tickTo(state: GameState, now: number): Decimal | null {
  const elapsed = now - state.lastUpdatedAt;
  if (elapsed < 0) { state.lastUpdatedAt = now; return null; }
  if (elapsed > balance.catchUpThresholdMs) return catchUp(state, now);
  const steps = Math.floor(elapsed / balance.tickMs);
  for (let i = 0; i < steps; i++) advanceWorld(state, balance.tickMs / 1000, true);
  state.lastUpdatedAt += steps * balance.tickMs;
  return null;
}
