import type Decimal from 'break_eternity.js';
import type { GameState } from '../state/gameState';

/** 羊を数えるの費用。 */
export interface MinigameCost {
  pillows: number;
  yawns: Decimal;
}

/**
 * ミニゲームの共通インターフェース（SPEC §5：{ id, unlockCondition, cost, start(), onFinish(result) }）。
 * どれも DOM に触らない。画面は ui/ 側で作る。費用の形はミニゲームごとに違う（Cost）。
 */
export interface Minigame<Session, Result, Reward, Cost = MinigameCost> {
  readonly id: string;
  unlockCondition(state: GameState): boolean;
  cost(state: GameState): Cost;
  /** 費用を払い、遊ぶ内容（乱数で決まる）を作る。払えなければ null */
  start(state: GameState): Session | null;
  /** 結果を確かめて報酬を与える */
  onFinish(state: GameState, session: Session, result: Result): Reward;
}
