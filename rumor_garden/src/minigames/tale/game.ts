import Decimal from 'break_eternity.js';
import { random } from '../../core/random';
import { taleBalance as b } from '../../data/tale';
import { production } from '../../systems/economy';
import type { GameState } from '../../state/game';
import type { Minigame } from '../index';
import type { TaleChoice } from './state';
import { finishTale, unlockTale } from './clock';

export function taleCost(state: GameState): Decimal {
  return Decimal.max(b.minimumCost, production(state, false).mul(b.costSeconds));
}
export function taleAvailable(state: GameState): boolean { return state.earned.gte(b.unlock); }
function validChoice(choice: string): choice is TaleChoice { return choice === 'safe' || choice === 'bold'; }
export function startTale(state: GameState, choice: TaleChoice): boolean {
  unlockTale(state);
  const cost = taleCost(state), tale = state.tale;
  if (!validChoice(choice) || !taleAvailable(state) || tale.round || tale.tickets < 1 ||
    state.currency.lt(cost) || tale.plays >= Number.MAX_SAFE_INTEGER) return false;
  const rolls: number[] = [];
  for (let i = 0; i < b.stages; i++) { const result = random(state.seed); state.seed = result.seed; rolls.push(result.value); }
  state.currency = state.currency.sub(cost); tale.spent = tale.spent.add(cost);
  tale.tickets--; tale.plays++; tale.lastOutcome = 'none'; tale.lastPoints = 0;
  tale.round = { rolls, stage: 0, points: 0, choice, remaining: b.stageSeconds, phase: 'running' };
  return true;
}
export function continueTale(state: GameState, choice: TaleChoice): boolean {
  const round = state.tale.round;
  if (!validChoice(choice) || !round || round.phase !== 'decision' || round.stage >= b.stages - 1) return false;
  round.stage++; round.choice = choice; round.remaining = b.stageSeconds; round.phase = 'running';
  return true;
}
export function bankTale(state: GameState): boolean {
  const round = state.tale.round;
  return !!round && round.phase === 'decision' && finishTale(state, round.points);
}
export const taleGame: Minigame<TaleChoice, number> = {
  id: 'tale', unlockCondition: taleAvailable, cost: taleCost, start: startTale, onFinish: finishTale,
};
