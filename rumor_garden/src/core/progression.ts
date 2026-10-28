import Decimal from 'break_eternity.js';
import { mythBalance } from '../data/myth';
import type { GameState } from '../state/game';
import { advance } from '../systems/economy';
import { advanceOnline } from '../systems/events';
import { automate, hasTimedAutomation } from '../systems/automation';

// Both online and offline purchases use identical one-second boundaries.
// Resets are handled separately by the save action layer, only while online.
export function advanceWorld(state: GameState, seconds: number, online: boolean): Decimal {
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Invalid elapsed time');
  const progress = online ? advanceOnline : advance;
  if (!hasTimedAutomation(state)) return progress(state, seconds);
  let remaining = seconds, gained = new Decimal(0);
  while (remaining > 0) {
    const dt = Math.min(remaining, mythBalance.autoInterval - state.automation.elapsed);
    gained = gained.add(progress(state, dt));
    state.automation.elapsed += dt;
    remaining = Math.max(0, remaining - dt);
    if (state.automation.elapsed >= mythBalance.autoInterval - 1e-9) {
      state.automation.elapsed = 0; automate(state);
    }
  }
  return gained;
}
