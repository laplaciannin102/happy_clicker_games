import { taleBalance as b } from '../../data/tale';
import type { GameState } from '../../state/game';

export function unlockTale(state: GameState): void {
  if (!state.tale.unlocked && state.earned.gte(b.unlock)) {
    state.tale.unlocked = true; state.tale.tickets = b.ticketCap; state.tale.recharge = 0;
  }
}
export function finishTale(state: GameState, points: number): boolean {
  const tale = state.tale;
  if (!tale.round || !Number.isInteger(points) || points < 0 || points > b.maxPoints) return false;
  tale.completed = Math.min(Number.MAX_SAFE_INTEGER, tale.completed + 1);
  tale.lastPoints = points; tale.lastOutcome = points > 0 ? 'banked' : 'failure';
  if (points > 0) {
    tale.wins = Math.min(Number.MAX_SAFE_INTEGER, tale.wins + 1);
    tale.bestPoints = Math.max(tale.bestPoints, points);
    tale.boost = Math.max(tale.boost, points * b.rewardSeconds);
    if (points === b.maxPoints) tale.illustration = true;
  }
  tale.round = null;
  return true;
}
// Called after production for this segment; a reward starts at the segment's end.
export function advanceTale(state: GameState, seconds: number): void {
  const tale = state.tale;
  tale.boost = Math.max(0, tale.boost - seconds);
  if (tale.unlocked && tale.tickets < b.ticketCap) {
    const total = tale.recharge + seconds;
    const recovered = Math.floor((total + 1e-9) / b.rechargeSeconds);
    tale.tickets = Math.min(b.ticketCap, tale.tickets + recovered);
    tale.recharge = tale.tickets === b.ticketCap ? 0 : Math.max(0, total - recovered * b.rechargeSeconds);
  }
  const round = tale.round;
  if (!round || round.phase !== 'running') return;
  round.remaining = Math.max(0, round.remaining - seconds);
  if (round.remaining > 1e-9) return;
  round.remaining = 0;
  const choice = b.choices[round.choice];
  if (round.rolls[round.stage] >= choice.chance) { finishTale(state, 0); return; }
  round.points += choice.points;
  if (round.stage === b.stages - 1) finishTale(state, round.points);
  else round.phase = 'decision';
}
