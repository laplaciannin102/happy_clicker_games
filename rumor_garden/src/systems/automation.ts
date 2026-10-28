import { mythBalance } from '../data/myth';
import { upgrades } from '../data/upgrades';
import type { GameState } from '../state/game';
import { buy, cost } from './economy';
import { buyUpgrade } from './upgrades';
import { prestigeReward } from './prestige';
import Decimal from 'break_eternity.js';

export type AutomationCommand = { kind: 'toggle'; target: 'purchase' | 'research' | 'prestige'; enabled: boolean }
  | { kind: 'target'; index: number; enabled: boolean }
  | { kind: 'move'; index: number; offset: -1 | 1 }
  | { kind: 'number'; target: 'reserve' | 'threshold'; value: string };
export function configureAutomation(state: GameState, command: AutomationCommand): boolean {
  const a = state.automation;
  if (state.myth.count < mythBalance.purchaseUnlock) return false;
  if (command.kind === 'toggle') {
    const required = command.target === 'purchase' ? mythBalance.purchaseUnlock
      : command.target === 'research' ? mythBalance.researchUnlock : mythBalance.prestigeUnlock;
    if (state.myth.count < required) return false;
    a[command.target] = command.enabled; a.elapsed = 0;
  } else if (command.kind === 'target') {
    if (!Number.isInteger(command.index) || command.index < 0 || command.index >= a.targets.length) return false;
    a.targets[command.index] = command.enabled;
  } else if (command.kind === 'move') {
    const from = a.order.indexOf(command.index), to = from + command.offset;
    if (from < 0 || to < 0 || to >= a.order.length) return false;
    [a.order[from], a.order[to]] = [a.order[to], a.order[from]];
  } else {
    if (command.value.length > 10000 || !command.value.trim()) return false;
    const value = new Decimal(command.value.trim());
    if (!value.isFinite() || value.lt(0) || (command.target === 'threshold' &&
      (state.myth.count < mythBalance.prestigeUnlock || value.lt(1) || !value.eq(value.floor())))) return false;
    a[command.target] = value;
  }
  return true;
}

export function hasTimedAutomation(state: GameState): boolean {
  return (state.myth.count >= mythBalance.purchaseUnlock && state.automation.purchase) ||
    (state.myth.count >= mythBalance.researchUnlock && state.automation.research);
}
export function automate(state: GameState): void {
  const a = state.automation;
  if (a.purchase && state.myth.count >= mythBalance.purchaseUnlock) {
    for (const i of a.order) {
      if (a.targets[i] && state.currency.sub(a.reserve).gte(cost(state, i))) buy(state, i, 1);
    }
  }
  if (a.research && state.myth.count >= mythBalance.researchUnlock) {
    for (const upgrade of upgrades) {
      if (state.currency.sub(a.reserve).gte(upgrade.cost)) buyUpgrade(state, upgrade.id);
    }
  }
}
export function shouldAutoPrestige(state: GameState): boolean {
  return state.myth.count >= mythBalance.prestigeUnlock && state.automation.prestige &&
    !state.challenge.active && state.prestige.count < Number.MAX_SAFE_INTEGER && prestigeReward(state).gte(state.automation.threshold);
}
