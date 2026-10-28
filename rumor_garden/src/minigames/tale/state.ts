import Decimal from 'break_eternity.js';

export type TaleChoice = 'safe' | 'bold';
export interface TaleRound {
  rolls: number[]; stage: number; points: number; choice: TaleChoice;
  remaining: number; phase: 'running' | 'decision';
}
export interface TaleState {
  unlocked: boolean; tickets: number; recharge: number; boost: number;
  spent: Decimal; plays: number; completed: number; wins: number; bestPoints: number;
  illustration: boolean; lastPoints: number; lastOutcome: 'none' | 'banked' | 'failure';
  round: TaleRound | null;
}
export function createTaleState(): TaleState {
  return { unlocked: false, tickets: 0, recharge: 0, boost: 0, spent: new Decimal(0),
    plays: 0, completed: 0, wins: 0, bestPoints: 0, illustration: false,
    lastPoints: 0, lastOutcome: 'none', round: null };
}
export function cloneTale(tale: TaleState): TaleState {
  return { ...tale, spent: new Decimal(tale.spent),
    round: tale.round ? { ...tale.round, rolls: [...tale.round.rolls] } : null };
}
