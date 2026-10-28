import Decimal from 'break_eternity.js';
import { createState, type GameState } from '../src/state/game';
import { producers } from '../src/data/balance';
import { upgrades } from '../src/data/upgrades';
import { buy, clickGain, cost, production, unlocked, whisper } from '../src/systems/economy';
import { buyUpgrade, upgradeUnlocked } from '../src/systems/upgrades';
import { collectEvent } from '../src/systems/events';
import { catchUp } from '../src/core/time';
import { cloneTale } from '../src/minigames/tale/state';
import { startTale, continueTale, bankTale } from '../src/minigames/tale/game';
import { cloneAutomation } from '../src/state/progression';
import { advanceWorld } from '../src/core/progression';
import { cloneMail } from '../src/minigames/mail/state';

export type Strategy = 'active' | 'purchase-only' | 'offline-after-5m';
function clone(state: GameState): GameState {
  return { ...state, preferences: { ...state.preferences }, mail: cloneMail(state.mail), tale: cloneTale(state.tale), owned: [...state.owned], upgrades: [...state.upgrades],
    generated: [...state.generated], lastOfflineGenerated: [...state.lastOfflineGenerated],
    myth: { ...state.myth }, challenge: { ...state.challenge, completed: [...state.challenge.completed] }, automation: cloneAutomation(state.automation),
    achievements: [...state.achievements], events: { ...state.events },
    records: { ...state.records, maxOwned: [...state.records.maxOwned] },
    prestige: { ...state.prestige, upgrades: [...state.prestige.upgrades] } };
}
export interface SimulationOptions { startState?: GameState; stopAt?: Decimal; clicksPerSecond?: number; talePolicy?: 'safe' | 'bold' | 'bank-safe'; stepSeconds?: number }
export function simulate(strategy: Strategy = 'active', duration = 1800, options: SimulationOptions = {}) {
  const state = options.startState ? clone(options.startState) : createState(0);
  if (!options.startState) state.seed = 20261028;
  const startedAt = state.lastUpdatedAt;
  let elapsed = 0;
  const thresholdTimes: Record<string, number> = {};
  const milestones = { firstPurchase: -1, thirdVisible: -1, fourthPurchase: -1,
    fifthPurchase: -1, sixthPurchase: -1, earned1e7: -1 };
  const clicksPerSecond = options.clicksPerSecond ?? (strategy === 'purchase-only' ? 0 : 2);
  if (strategy === 'purchase-only') for (let i = 0; i < 10; i++) whisper(state);
  const effective = (value: GameState) => production(value).add(clickGain(value).mul(new Decimal(clicksPerSecond)));
  const step = options.stepSeconds ?? 0.5;
  for (let time = step; time <= duration; time += step) {
    elapsed = time;
    if (strategy === 'offline-after-5m' && time > 300) { catchUp(state, startedAt + duration * 1000); elapsed = duration; break; }
    advanceWorld(state, step, true); state.lastUpdatedAt = startedAt + time * 1000;
    const previousClicks = Math.floor((time - step) * clicksPerSecond);
    const clicks = Math.floor(time * clicksPerSecond) - previousClicks;
    for (let i = 0; i < clicks; i++) whisper(state);
    if (state.events.visible > 0) collectEvent(state);
    if (options.talePolicy) {
      const choice = options.talePolicy === 'bold' ? 'bold' : 'safe';
      if (!state.tale.round) startTale(state, choice);
      else if (state.tale.round.phase === 'decision') {
        if (options.talePolicy === 'bank-safe') bankTale(state);
        else continueTale(state, choice);
      }
    }
    for (let action = 0; action < 100; action++) {
      const current = effective(state);
      let best: { score: Decimal; price: Decimal; buy: () => boolean } | undefined;
      function consider(price: Decimal, candidate: GameState, purchase: () => boolean) {
        const gain = effective(candidate).sub(current);
        if (gain.lte(0)) return;
        const score = price.div(gain);
        if (!best || score.lt(best.score)) best = { score, price, buy: purchase };
      }
      producers.forEach((_, index) => {
        if (!unlocked(state, index)) return;
        const price = cost(state, index), candidate = clone(state);
        candidate.currency = price;
        buy(candidate, index, 1);
        consider(price, candidate, () => buy(state, index, 1));
      });
      upgrades.forEach(upgrade => {
        if (!upgradeUnlocked(state, upgrade) || state.upgrades.includes(upgrade.id)) return;
        const candidate = clone(state); candidate.currency = upgrade.cost;
        buyUpgrade(candidate, upgrade.id);
        consider(upgrade.cost, candidate, () => buyUpgrade(state, upgrade.id));
      });
      if (!best || state.currency.lt(best.price) || !best.buy()) break;
    }
    if (milestones.firstPurchase < 0 && state.owned[0] > 0) milestones.firstPurchase = time;
    if (milestones.thirdVisible < 0 && unlocked(state, 2)) milestones.thirdVisible = time;
    if (milestones.fourthPurchase < 0 && state.owned[3] > 0) milestones.fourthPurchase = time;
    if (milestones.fifthPurchase < 0 && state.owned[4] > 0) milestones.fifthPurchase = time;
    if (milestones.sixthPurchase < 0 && state.owned[5] > 0) milestones.sixthPurchase = time;
    if (milestones.earned1e7 < 0 && state.earned.gte('1e7')) milestones.earned1e7 = time;
    for (const threshold of ['1e16', '1e17', '1e18', '1e19']) {
      if (thresholdTimes[threshold] === undefined && state.earned.gte(threshold)) thresholdTimes[threshold] = time;
    }
    if (options.stopAt && state.earned.gte(options.stopAt)) break;
  }
  const report = { strategy, seconds: elapsed, clicksPerSecond, milestones, thresholdTimes, earned: state.earned.toString(),
    currency: state.currency.toString(), rate: production(state).toString(), owned: state.owned,
    upgrades: state.upgrades.length, achievements: state.achievements.length, events: state.events.collected,
    tale: { plays: state.tale.plays, wins: state.tale.wins, bestPoints: state.tale.bestPoints, spent: state.tale.spent.toString() } };
  return { state, report };
}
