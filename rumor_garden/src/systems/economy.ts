import Decimal from 'break_eternity.js';
import { balance, producers } from '../data/balance';
import type { BuyMode, GameState } from '../state/game';
import { upgrades, producerUpgradeCount } from '../data/upgrades';
import { grantAchievements, nextMilestone } from './achievements';
import { permanentUpgrades, prestigeBalance } from '../data/prestige';
import { taleBalance } from '../data/tale';
import { advanceTale, unlockTale } from '../minigames/tale/clock';
import { mythBalance } from '../data/myth';
import { chainActive, chainEvolution, totalOwned } from './chain';
import { achievements } from '../data/achievements';
import { unlockMail, advanceMail } from '../minigames/mail/clock';

function chainIncome(state: GameState, seconds: number): Decimal {
  return chainEvolution(state, seconds).integral.reduce((sum, n, i) => sum.add(n.mul(unitRate(state, i))), new Decimal(0));
}
function achievementsEarnedTargets(state: GameState, income: Decimal): Decimal[] {
  return achievements.filter(a => a.kind === 'earned' && !state.achievements.includes(a.id) &&
    a.target.gt(state.earned) && a.target.lte(state.earned.add(income))).map(a => a.target).sort((a, b) => a.cmp(b));
}

export function temporaryMultiplier(state: GameState): Decimal {
  const event = state.events.boost > 0 ? balance.eventMultiplier : new Decimal(1);
  const tale = state.tale.boost > 0 ? taleBalance.multiplier : new Decimal(1);
  return Decimal.min(taleBalance.maxTemporary, event.mul(tale));
}

export function unlocked(state: GameState, index: number): boolean {
  if (state.challenge.active === 'alleys' && index >= 4) return false;
  return index === 0 || (state.owned[index - 1] > 0 &&
    state.earned.gte(producers[index].baseCost.mul(balance.revealRatio)));
}

export function achievementMultiplier(state: GameState): Decimal {
  return balance.achievementBonus.mul(new Decimal(state.achievements.length)).add(1);
}

export function prestigeMultiplier(state: GameState): Decimal {
  return prestigeBalance.bonusPerPoint.mul(state.prestige.total).add(1);
}

export function mythMultiplier(state: GameState): Decimal {
  return mythBalance.multiplier.pow(new Decimal(state.myth.count))
    .mul(mythBalance.challengeMultiplier.pow(new Decimal(state.challenge.completed.length)));
}

export function producerRate(state: GameState, index: number, boosted = true): Decimal {
  return unitRate(state, index, boosted).mul(totalOwned(state, index));
}
export function unitRate(state: GameState, index: number, boosted = true): Decimal {
  if (state.challenge.active === 'alleys' && index >= 4) return new Decimal(0);
  const adjacent = Math.min(state.owned[index + 1] ?? 0, balance.synergyCap);
  const synergy = balance.synergyPerOwned.mul(new Decimal(adjacent)).add(1);
  let multiplier = achievementMultiplier(state).mul(prestigeMultiplier(state)).mul(mythMultiplier(state));
  for (const upgrade of upgrades.slice(index * producerUpgradeCount, (index + 1) * producerUpgradeCount)) {
    if (state.upgrades.includes(upgrade.id)) multiplier = multiplier.mul(upgrade.multiplier);
  }
  if (boosted) multiplier = multiplier.mul(temporaryMultiplier(state));
  return producers[index].production.mul(synergy).mul(multiplier);
}

export function production(state: GameState, boosted = true): Decimal {
  return producers.reduce((sum, _, i) => sum.add(producerRate(state, i, boosted)), new Decimal(0));
}

export function clickGain(state: GameState): Decimal {
  if (state.challenge.active === 'silent') return new Decimal(0);
  // Clicking alone must not silently strengthen a new game's first click.
  if (state.prestige.count === 0 && state.myth.count === 0 && state.upgrades.length === 0 &&
    state.owned.every(count => count === 0)) return new Decimal(balance.clickBase);
  let base = balance.clickBase;
  for (const upgrade of upgrades) {
    if (upgrade.producer === null && state.upgrades.includes(upgrade.id)) base = base.add(upgrade.clickAdd);
  }
  base = base.mul(achievementMultiplier(state)).mul(prestigeMultiplier(state)).mul(mythMultiplier(state));
  for (const upgrade of permanentUpgrades) {
    if (state.prestige.upgrades.includes(upgrade.id)) base = base.mul(upgrade.clickMultiplier);
  }
  if (state.events.boost > 0) base = base.mul(balance.eventMultiplier);
  return base.add(production(state, false).mul(balance.clickProductionRatio));
}

function credit(state: GameState, amount: Decimal): void {
  state.currency = state.currency.add(amount);
  state.earned = state.earned.add(amount);
  state.lifetimeEarned = state.lifetimeEarned.add(amount);
  unlockTale(state);
  unlockMail(state);
}

export function whisper(state: GameState): void {
  if (state.challenge.active === 'silent') return;
  credit(state, clickGain(state));
  state.clicks = Math.min(Number.MAX_SAFE_INTEGER, state.clicks + 1);
  state.runClicks = Math.min(Number.MAX_SAFE_INTEGER, state.runClicks + 1);
  grantAchievements(state);
}

export function advance(state: GameState, seconds: number): Decimal {
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Invalid elapsed time');
  let remaining = seconds, gained = new Decimal(0);
  grantAchievements(state);
  while (remaining > 0) {
    const rate = production(state);
    let until = state.events.boost > 0 ? Math.min(remaining, state.events.boost) : remaining;
    if (state.tale.boost > 0) until = Math.min(until, state.tale.boost);
    if (state.tale.round?.phase === 'running') until = Math.min(until, state.tale.round.remaining);
    if (state.mail.round?.phase === 'running') until = Math.min(until, state.mail.round.remaining);
    const milestone = nextMilestone(state, rate, until);
    if (chainActive(state) && achievements.some(a => a.kind === 'earned' && !state.achievements.includes(a.id))) {
      const predicted = chainIncome(state, until);
      const targets = achievementsEarnedTargets(state, predicted);
      if (targets.length) {
        const target = targets[0]; let lo = 0, hi = until;
        for (let i = 0; i < 40; i++) {
          const mid = (lo + hi) / 2;
          if (chainIncome(state, mid).gte(target.sub(state.earned))) hi = mid; else lo = mid;
        }
        if (hi < milestone.seconds) { milestone.seconds = hi; milestone.earned = target; milestone.playSeconds = undefined; }
      }
    }
    const dt = milestone.seconds;
    const evolution = chainActive(state) ? chainEvolution(state, dt) : null;
    const amount = milestone.earned ? milestone.earned.sub(state.earned) : evolution
      ? evolution.integral.reduce((sum, n, i) => sum.add(n.mul(unitRate(state, i))), new Decimal(0)) : rate.mul(new Decimal(dt));
    if (evolution) state.generated = evolution.generated;
    credit(state, amount); gained = gained.add(amount);
    state.playSeconds = milestone.playSeconds ?? state.playSeconds + dt;
    state.runSeconds += dt;
    state.events.boost = Math.max(0, state.events.boost - dt);
    advanceTale(state, dt);
    advanceMail(state, dt);
    grantAchievements(state);
    remaining = Math.max(0, remaining - dt);
  }
  return gained;
}

export function cost(state: GameState, index: number, quantity = 1): Decimal {
  const purchased = state.owned[index] - (index === 0 ? state.startingNeighbors : 0);
  const first = producers[index].baseCost.mul(balance.growth.pow(new Decimal(purchased)));
  if (quantity === 1) return first;
  if (quantity === 0) return new Decimal(0);
  return first.mul(balance.growth.pow(new Decimal(quantity)).sub(1)).div(balance.growth.sub(1));
}

export function purchaseQuantity(state: GameState, index: number, mode: BuyMode): number {
  if (!unlocked(state, index)) return 0;
  const room = Number.MAX_SAFE_INTEGER - state.owned[index];
  if (mode !== 'max') return Math.min(mode, room);
  const first = cost(state, index);
  if (state.currency.lt(first)) return 0;
  const estimate = state.currency.mul(balance.growth.sub(1)).div(first).add(1)
    .log(balance.growth).floor().toNumber();
  let quantity = Math.min(room, Math.max(0, estimate));
  // Correct logarithm rounding at exact purchase boundaries.
  while (quantity > 0 && cost(state, index, quantity).gt(state.currency)) quantity--;
  while (quantity < room && cost(state, index, quantity + 1).lte(state.currency)) quantity++;
  return quantity;
}

export function buy(state: GameState, index: number, mode: BuyMode): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= producers.length) return false;
  const quantity = purchaseQuantity(state, index, mode);
  if (quantity < 1) return false;
  const price = cost(state, index, quantity);
  if (state.currency.lt(price)) return false;
  state.currency = state.currency.sub(price);
  state.owned[index] += quantity;
  grantAchievements(state);
  return true;
}
