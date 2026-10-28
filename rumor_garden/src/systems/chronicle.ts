import { mailBalance as b } from '../data/mail';
import { challengeIds } from '../data/myth';
import type { GameState } from '../state/game';
export function chronicleProgress(state: GameState): boolean[] {
  return [state.myth.count >= b.epilogueMyths,
    challengeIds.every(id => state.challenge.completed.includes(id)),
    state.tale.illustration, b.postcards.every(id => state.mail.postcards.includes(id))];
}
export function canReadEpilogue(state: GameState): boolean { return chronicleProgress(state).every(Boolean); }
export function readEpilogue(state: GameState): boolean {
  if (state.mail.epilogueSeen || !canReadEpilogue(state)) return false;
  state.mail.epilogueSeen = true; return true;
}
