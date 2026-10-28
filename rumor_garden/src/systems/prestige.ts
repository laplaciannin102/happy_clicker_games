import Decimal from 'break_eternity.js';
import { permanentUpgrades, prestigeBalance } from '../data/prestige';
import { createState, type GameState } from '../state/game';
import { grantAchievements } from './achievements';
import { cloneTale } from '../minigames/tale/state';
import { cloneAutomation } from '../state/progression';
import { cloneMail } from '../minigames/mail/state';

export function prestigeReward(state: GameState): Decimal {
  if (state.earned.lt(prestigeBalance.requirement)) return new Decimal(0);
  let reward = state.earned.div(prestigeBalance.requirement).sqrt().floor();
  // The square root may round just below an integer (for example sqrt(25)).
  // Compare with the original requirement, and stop if ±1 is no longer representable.
  while (reward.gt(0) && reward.pow(2).mul(prestigeBalance.requirement).gt(state.earned)) {
    const previous = reward.sub(1); if (previous.eq(reward)) break; reward = previous;
  }
  while (true) {
    const next = reward.add(1);
    if (next.eq(reward) || next.pow(2).mul(prestigeBalance.requirement).gt(state.earned)) break;
    reward = next;
  }
  return reward;
}
export function nextPrestigeTarget(state: GameState): Decimal {
  return prestigeReward(state).add(1).pow(2).mul(prestigeBalance.requirement);
}
export function buyPermanentUpgrade(state: GameState, id: string): boolean {
  const upgrade = permanentUpgrades.find(item => item.id === id);
  if (!upgrade || state.prestige.upgrades.includes(id) || state.prestige.points.lt(upgrade.cost)) return false;
  state.prestige.points = state.prestige.points.sub(upgrade.cost);
  state.prestige.upgrades.push(id);
  return true;
}

// Construct a new run without changing the source. Storage must succeed before adoption.
export function createPrestigeState(state: GameState, now: number): GameState | null {
  const reward = prestigeReward(state);
  if (state.challenge.active || reward.lt(1) || state.prestige.count >= Number.MAX_SAFE_INTEGER) return null;
  const next = createRunState(state, now);
  next.prestige.points = next.prestige.points.add(reward); next.prestige.total = next.prestige.total.add(reward);
  next.prestige.count++; next.prestige.lastGain = reward;
  grantAchievements(next);
  return next;
}

export function createRunState(state: GameState, now: number): GameState {
  const next = createState(now);
  next.preferences = { ...state.preferences };
  next.mail = cloneMail(state.mail); next.mail.round = null; next.mail.spent = new Decimal(0);
  next.myth = { ...state.myth, archivedPoints: new Decimal(state.myth.archivedPoints) };
  next.challenge = { active: state.challenge.active, completed: [...state.challenge.completed] };
  next.automation = cloneAutomation(state.automation); next.automation.elapsed = 0;
  next.lastOfflineGenerated = state.lastOfflineGenerated.map(n => new Decimal(n));
  next.tale = cloneTale(state.tale);
  next.tale.round = null; next.tale.boost = 0; next.tale.spent = new Decimal(0);
  next.lifetimeEarned = new Decimal(state.lifetimeEarned);
  next.clicks = state.clicks; next.playSeconds = state.playSeconds;
  next.seed = state.seed; next.format = state.format; next.buyMode = state.buyMode; next.tainted = state.tainted;
  next.achievements = [...state.achievements];
  next.records = { maxOwned: state.records.maxOwned.map((count, index) => Math.max(count, state.owned[index])),
    bestRunEarned: Decimal.max(state.records.bestRunEarned, state.earned),
    bestAllOwned: Math.max(state.records.bestAllOwned, Math.min(...state.owned)) };
  next.prestige = { points: new Decimal(state.prestige.points), total: new Decimal(state.prestige.total),
    count: state.prestige.count, upgrades: [...state.prestige.upgrades], lastGain: new Decimal(state.prestige.lastGain) };
  next.events.collected = state.events.collected;
  next.offlineSeconds = state.offlineSeconds; next.offlineEarned = new Decimal(state.offlineEarned);
  next.lastOffline = { ...state.lastOffline, gained: new Decimal(state.lastOffline.gained) };
  for (const upgrade of permanentUpgrades) {
    if (next.prestige.upgrades.includes(upgrade.id)) next.startingNeighbors += upgrade.startingNeighbors;
  }
  next.owned[0] = next.startingNeighbors;
  grantAchievements(next);
  return next;
}
