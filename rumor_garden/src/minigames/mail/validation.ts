import { mailBalance as b } from '../../data/mail';
import type { GameState } from '../../state/game';
import { canReadEpilogue } from '../../systems/chronicle';
export function inconsistentMail(state: GameState): boolean {
  const m = state.mail, r = m.round;
  return (!m.unlocked && !!(m.tickets || m.recharge || m.plays || m.completed || m.deliveries || m.lastCorrect || m.postcards.length || m.spent.gt(0) || r)) ||
    (m.unlocked && (state.myth.count < b.mythUnlock || state.records.bestRunEarned.lt(b.unlock))) ||
    (m.tickets === b.ticketCap && m.recharge !== 0) || m.completed > m.plays || m.deliveries > m.completed ||
    m.postcards.length !== Math.min(b.postcards.length,m.deliveries) ||
    m.postcards.some((id,i) => id !== b.postcards[i]) ||
    (m.completed === 0 && m.lastCorrect !== 0) || (m.lastCorrect >= b.correctRequired && m.deliveries === 0) ||
    m.plays > b.ticketCap + Math.floor((state.playSeconds+0.001)/b.rechargeSeconds) ||
    m.completed * b.stages * b.stageSeconds > state.playSeconds + 0.001 ||
    (r !== null && m.plays <= m.completed) || (m.epilogueSeen && !canReadEpilogue(state));
}
