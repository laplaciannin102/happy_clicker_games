import Decimal from 'break_eternity.js';
import { balance, producers } from '../data/balance';
import { upgrades } from '../data/upgrades';
import { achievements } from '../data/achievements';
import { permanentUpgrades, prestigeBalance } from '../data/prestige';
import { createState, type GameState } from '../state/game';
import { clickGain, cost, production, unlocked } from '../systems/economy';
import { upgradeUnlocked } from '../systems/upgrades';
import { eligible } from '../systems/achievements';
import { inconsistentTale } from '../minigames/tale/validation';
import { taleBalance } from '../data/tale';
import { mythBalance } from '../data/myth';
import { chainActive, chainEvolution } from '../systems/chain';
import { inconsistentMail } from '../minigames/mail/validation';

// Current-run bounds stay valid across prestige. Archived records are checked against
// lifetime lower bounds; they are not a cryptographic proof of the complete play history.
export function inconsistent(state: GameState, now: number): boolean {
  if (inconsistentTale(state) || inconsistentMail(state)) return true;
  const tolerance = new Decimal('1.000001');
  const exceeds = (value: Decimal, bound: Decimal) => value.gt(bound.mul(tolerance).add('0.001'));
  if (state.currency.gt(state.earned) || state.lastUpdatedAt > now || exceeds(state.earned, state.lifetimeEarned) ||
    state.runClicks > state.clicks || state.runSeconds > state.playSeconds + 0.001 ||
    state.records.bestRunEarned.lt(state.earned) || exceeds(state.records.bestRunEarned, state.lifetimeEarned)) return true;
  const p = state.prestige;
  const m = state.myth, c = state.challenge, a = state.automation;
  const claims = p.count - m.archivedPrestiges;
  if (claims < 0 || m.archivedPoints.lt(mythBalance.requirement.mul(new Decimal(m.count))) ||
    (m.count === 0 && (m.archivedPoints.gt(0) || m.archivedPrestiges > 0 || c.active || c.completed.length)) ||
    !m.archivedPoints.eq(m.archivedPoints.floor()) ||
    (a.purchase && m.count < mythBalance.purchaseUnlock) || (a.research && m.count < mythBalance.researchUnlock) ||
    (a.prestige && m.count < mythBalance.prestigeUnlock) ||
    (c.active === 'silent' && (!p.upgrades.includes('inheritance') || state.runClicks > 0)) ||
    (c.completed.length > 0 && state.records.bestRunEarned.lt(mythBalance.challengeGoal))) return true;
  if (!p.points.eq(p.points.floor()) || !p.total.eq(p.total.floor()) || !p.lastGain.eq(p.lastGain.floor()) ||
    p.points.gt(p.total) || p.lastGain.gt(p.total) || p.total.lt(claims) ||
    (claims === 0 && (p.total.gt(0) || p.lastGain.gt(0))) || (claims > 0 && p.lastGain.lt(1))) return true;
  let permanentSpent = new Decimal(0);
  for (const id of p.upgrades) {
    const upgrade = permanentUpgrades.find(item => item.id === id);
    if (!upgrade) return true;
    permanentSpent = permanentSpent.add(upgrade.cost);
  }
  if (exceeds(p.points.add(permanentSpent), p.total) || exceeds(p.total, p.points.add(permanentSpent))) return true;
  if (p.count > 0) {
    const currentMinimum = claims > 0 ? p.total.pow(2).div(new Decimal(claims)) : new Decimal(0);
    const minimum = currentMinimum.add(m.archivedPoints).mul(prestigeBalance.requirement);
    if (exceeds(minimum, state.lifetimeEarned)) return true;
  }
  const gift = state.startingNeighbors;
  if (![0, prestigeBalance.startingNeighbors].includes(gift) || state.owned[0] < gift ||
    (gift > 0 && (!p.upgrades.includes('inheritance') || p.count === 0))) return true;
  const initial = createState(now);
  if (chainActive(state)) {
    const bound = chainEvolution({ ...state, generated: initial.generated }, state.runSeconds).generated;
    if (state.generated.some((value, i) => exceeds(value, bound[i]))) return true;
  } else if (state.generated.some(value => value.gt(0))) return true;
  let spent = new Decimal(0), historicalMinimum = new Decimal(0);
  for (let i = 0; i < producers.length; i++) {
    if (state.owned[i] > 0 && !unlocked(state, i)) return true;
    if (state.records.maxOwned[i] < state.owned[i]) return true;
    spent = spent.add(cost(initial, i, state.owned[i] - (i === 0 ? gift : 0)));
    const pastGift = i === 0 && (p.upgrades.includes('inheritance') || m.count > 0) && p.count > 0
      ? prestigeBalance.startingNeighbors : 0;
    historicalMinimum = historicalMinimum.add(cost(initial, i, Math.max(0, state.records.maxOwned[i] - pastGift)));
  }
  if (state.records.bestAllOwned > Math.min(...state.records.maxOwned) ||
    exceeds(historicalMinimum, state.lifetimeEarned)) return true;
  for (const id of state.upgrades) {
    const upgrade = upgrades.find(item => item.id === id);
    if (!upgrade || !upgradeUnlocked(state, upgrade)) return true;
    spent = spent.add(upgrade.cost);
  }
  for (const id of state.achievements) {
    const achievement = achievements.find(item => item.id === id);
    if (!achievement || !eligible(state, achievement)) return true;
  }
  if (state.offlineSeconds > state.playSeconds + 0.001 || exceeds(state.offlineEarned, state.lifetimeEarned) ||
    exceeds(state.lastOffline.gained, state.offlineEarned) || state.lastOffline.seconds > state.offlineSeconds + 0.001 ||
    state.events.collected * balance.eventIntervalMin > state.playSeconds + 0.001 ||
    (state.events.visible > 0 && state.events.wait < state.events.visible) ||
    ((state.events.boost > 0 || state.events.visible > 0 || state.events.wait >= 0) && state.earned.lt(balance.eventUnlock))) return true;
  if (exceeds(spent.add(state.tale.spent).add(state.mail.spent).add(state.currency), state.earned)) return true;
  const upperBound = production(state, false).mul(taleBalance.maxTemporary).mul(new Decimal(state.runSeconds))
    .add(clickGain(state).mul(balance.eventMultiplier).mul(new Decimal(state.runClicks)));
  return exceeds(state.earned, upperBound);
}
