import Decimal from 'break_eternity.js';
import { random } from '../../core/random';
import { mailBalance as b } from '../../data/mail';
import type { GameState } from '../../state/game';
import { production } from '../../systems/economy';
import type { Minigame } from '../index';
import { finishMail, unlockMail } from './clock';

export function mailAvailable(state: GameState): boolean { return state.myth.count >= b.mythUnlock && state.earned.gte(b.unlock); }
export function mailCost(state: GameState): Decimal { return Decimal.max(b.minimumCost, production(state, false).mul(b.costSeconds)); }
export function startMail(state: GameState): boolean {
  unlockMail(state); const m = state.mail, cost = mailCost(state);
  if (!mailAvailable(state) || m.round || m.tickets < 1 || state.currency.lt(cost) || m.plays >= Number.MAX_SAFE_INTEGER) return false;
  const destinations: number[] = [], variants: number[] = [];
  for (let i = 0; i < b.stages; i++) {
    const d = random(state.seed), v = random(d.seed); state.seed = v.seed;
    destinations.push(Math.floor(d.value * b.destinations)); variants.push(Math.floor(v.value * b.variants));
  }
  m.spent = m.spent.add(cost); state.currency = state.currency.sub(cost); m.tickets--; m.plays++;
  m.round = { destinations, variants, answers: [], stage: 0, remaining: 0, phase: 'ready' };
  return true;
}
export function answerMail(state: GameState, destination: number): boolean {
  const r = state.mail.round;
  if (!Number.isInteger(destination) || destination < 0 || destination >= b.destinations || !r || r.phase !== 'ready') return false;
  r.answers.push(destination); r.remaining = b.stageSeconds; r.phase = 'running'; return true;
}
export const mailGame: Minigame<void, number> = {
  id: 'mail', unlockCondition: mailAvailable, cost: mailCost, start: startMail, onFinish: finishMail,
};
