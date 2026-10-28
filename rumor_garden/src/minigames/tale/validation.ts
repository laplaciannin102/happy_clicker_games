import { taleBalance as b } from '../../data/tale';
import type { GameState } from '../../state/game';

export function inconsistentTale(state: GameState): boolean {
  const t = state.tale, r = t.round;
  if ((!t.unlocked && (t.tickets || t.recharge || t.plays || t.boost || r)) ||
    (t.unlocked && state.records.bestRunEarned.lt(b.unlock)) ||
    (t.tickets === b.ticketCap && t.recharge !== 0) || t.completed > t.plays || t.wins > t.completed ||
    (t.bestPoints > 0 && t.wins === 0) || (t.boost > 0 && t.wins === 0) ||
    t.illustration !== (t.bestPoints === b.maxPoints) || t.lastPoints > t.bestPoints ||
    (t.lastOutcome === 'banked' && t.lastPoints === 0) ||
    (t.lastOutcome !== 'banked' && t.lastPoints !== 0) ||
    t.plays > b.ticketCap + Math.floor((state.playSeconds + 0.001) / b.rechargeSeconds)) return true;
  if (!r) return false;
  const stages = r.stage + (r.phase === 'decision' ? 1 : 0);
  return t.plays <= t.completed || t.lastOutcome !== 'none' ||
    r.points < stages || r.points > stages * b.choices.bold.points ||
    (r.phase === 'decision' && (r.stage >= b.stages - 1 || r.rolls[r.stage] >= b.choices[r.choice].chance));
}
