import Decimal from 'break_eternity.js';
import { balance } from '../data/balance';
import { random } from '../core/random';
import type { GameState } from '../state/game';
import { advance } from './economy';
import { grantAchievements } from './achievements';

function interval(state: GameState): number {
  const result = random(state.seed); state.seed = result.seed;
  return balance.eventIntervalMin + result.value * (balance.eventIntervalMax - balance.eventIntervalMin);
}

export function collectEvent(state: GameState): boolean {
  if (state.events.visible <= 0 || state.earned.lt(balance.eventUnlock)) return false;
  state.events.visible = 0;
  state.events.boost = balance.eventBoostSeconds;
  state.events.collected = Math.min(Number.MAX_SAFE_INTEGER, state.events.collected + 1);
  grantAchievements(state);
  return true;
}

export function advanceOnline(state: GameState, seconds: number): Decimal {
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Invalid elapsed time');
  if (state.earned.lt(balance.eventUnlock)) return advance(state, seconds);
  if (state.events.wait < 0) state.events.wait = interval(state);
  let remaining = seconds, gained = new Decimal(0);
  while (remaining > 0) {
    const showing = state.events.visible > 0;
    const until = showing ? state.events.visible : state.events.wait;
    if (!showing && until <= 0) {
      state.events.visible = balance.eventVisibleSeconds;
      state.events.wait = interval(state);
      continue;
    }
    const dt = Math.min(remaining, until);
    gained = gained.add(advance(state, dt));
    if (showing) state.events.visible = Math.max(0, state.events.visible - dt);
    // The next appearance is 90–150 active seconds after the previous one,
    // including the current event's visible time.
    state.events.wait = Math.max(0, state.events.wait - dt);
    remaining = Math.max(0, remaining - dt);
  }
  // Show an event reached exactly at the end of this step.
  if (state.events.visible === 0 && state.events.wait === 0) {
    state.events.visible = balance.eventVisibleSeconds; state.events.wait = interval(state);
  }
  return gained;
}
