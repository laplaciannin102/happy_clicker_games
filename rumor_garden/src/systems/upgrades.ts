import Decimal from 'break_eternity.js';
import { upgrades, type Upgrade } from '../data/upgrades';
import type { GameState } from '../state/game';

export function upgradeUnlocked(state: GameState, upgrade: Upgrade): boolean {
  if (state.challenge.active === 'alleys' && upgrade.producer !== null && upgrade.producer >= 4) return false;
  return upgrade.producer === null ? state.earned.gte(upgrade.requirement)
    : new Decimal(state.owned[upgrade.producer]).gte(upgrade.requirement);
}
export function buyUpgrade(state: GameState, id: string): boolean {
  const upgrade = upgrades.find(item => item.id === id);
  if (!upgrade || state.upgrades.includes(id) || !upgradeUnlocked(state, upgrade) || state.currency.lt(upgrade.cost)) return false;
  state.currency = state.currency.sub(upgrade.cost);
  state.upgrades.push(id);
  return true;
}
