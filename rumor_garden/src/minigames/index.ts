import type Decimal from 'break_eternity.js';
import type { GameState } from '../state/game';
import { taleGame } from './tale/game';
import { mailGame } from './mail/game';

export interface Minigame<Choice, Result> {
  id: string; unlockCondition(state: GameState): boolean; cost(state: GameState): Decimal;
  start(state: GameState, choice: Choice): boolean; onFinish(state: GameState, result: Result): boolean;
}
export const minigames = [taleGame, mailGame] as const;
