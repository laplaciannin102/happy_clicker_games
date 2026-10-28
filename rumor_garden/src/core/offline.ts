import Decimal from 'break_eternity.js';
import { balance } from '../data/balance';
import { presentation } from '../data/presentation';
import type { GameState } from '../state/game';
import { advanceWorld } from './progression';
import { finishCatchUp } from './time';
import { hasTimedAutomation } from '../systems/automation';

export interface OfflineHooks {
  progress?(fraction: number): void;
  yieldControl?(): Promise<void>;
  clock?(): number;
}
// A posted task lets paint/input run without nested setTimeout clamping.
export function yieldToBrowser(): Promise<void> {
  return new Promise(resolve => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => { channel.port1.close(); channel.port2.close(); resolve(); };
    channel.port2.postMessage(null);
  });
}
export async function catchUpAsync(state: GameState, now: number, hooks: OfflineHooks = {}): Promise<Decimal> {
  const actual = Math.max(0, now - state.lastUpdatedAt), elapsed = Math.min(actual, balance.offlineCapMs);
  const total = elapsed / 1000, before = [...state.generated];
  const clock = hooks.clock ?? (() => performance.now());
  const yieldControl = hooks.yieldControl ?? yieldToBrowser;
  let remaining = total, gained = new Decimal(0), started = clock();
  hooks.progress?.(0);
  if (elapsed > balance.catchUpThresholdMs && hasTimedAutomation(state)) { await yieldControl(); started = clock(); }
  while (remaining > 0) {
    const dt = hasTimedAutomation(state) ? Math.min(remaining, presentation.offlineStepSeconds) : remaining;
    gained = gained.add(advanceWorld(state, dt, false));
    remaining = Math.max(0, remaining - dt);
    if (remaining > 0 && clock() - started >= presentation.offlineBudgetMs) {
      hooks.progress?.((total - remaining) / total); await yieldControl(); started = clock();
    }
  }
  finishCatchUp(state, now, actual, elapsed, gained, before);
  hooks.progress?.(1);
  return gained;
}
