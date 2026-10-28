import { mailBalance as b } from '../../data/mail';
import type { GameState } from '../../state/game';

export function unlockMail(state: GameState): void {
  if (!state.mail.unlocked && state.myth.count >= b.mythUnlock && state.earned.gte(b.unlock)) {
    state.mail.unlocked = true; state.mail.tickets = b.ticketCap;
  }
}
export function correctAnswers(state: GameState): number {
  const r = state.mail.round;
  return r ? r.answers.filter((answer, i) => answer === r.destinations[i]).length : 0;
}
export function finishMail(state: GameState, result: number): boolean {
  const m = state.mail, r = m.round;
  if (!r || r.stage !== b.stages - 1 || r.phase !== 'running' || r.remaining !== 0 ||
    r.answers.length !== b.stages || result !== correctAnswers(state)) return false;
  m.completed++; m.lastCorrect = result;
  if (result >= b.correctRequired) {
    m.deliveries++;
    const next = b.postcards.find(id => !m.postcards.includes(id)); if (next) m.postcards.push(next);
  }
  m.round = null; return true;
}
export function advanceMail(state: GameState, seconds: number): void {
  const m = state.mail;
  if (m.unlocked && m.tickets < b.ticketCap) {
    const total = m.recharge + seconds, recovered = Math.floor((total + 1e-9) / b.rechargeSeconds);
    m.tickets = Math.min(b.ticketCap, m.tickets + recovered);
    m.recharge = m.tickets === b.ticketCap ? 0 : Math.max(0, total - recovered * b.rechargeSeconds);
  }
  const r = m.round; if (!r || r.phase !== 'running') return;
  r.remaining = Math.max(0, r.remaining - seconds);
  if (r.remaining > 1e-9) return;
  r.remaining = 0;
  if (r.stage === b.stages - 1) finishMail(state, correctAnswers(state));
  else { r.stage++; r.phase = 'ready'; }
}
