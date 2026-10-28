import Decimal from 'break_eternity.js';
export interface MailRound {
  destinations: number[]; variants: number[]; answers: number[]; stage: number;
  remaining: number; phase: 'ready' | 'running';
}
export interface MailState {
  unlocked: boolean; tickets: number; recharge: number; spent: Decimal;
  plays: number; completed: number; deliveries: number; lastCorrect: number;
  postcards: string[]; epilogueSeen: boolean; round: MailRound | null;
}
export function createMailState(): MailState {
  return { unlocked: false, tickets: 0, recharge: 0, spent: new Decimal(0), plays: 0,
    completed: 0, deliveries: 0, lastCorrect: 0, postcards: [], epilogueSeen: false, round: null };
}
export function cloneMail(mail: MailState): MailState {
  return { ...mail, spent: new Decimal(mail.spent), postcards: [...mail.postcards],
    round: mail.round ? { ...mail.round, destinations: [...mail.round.destinations],
      variants: [...mail.round.variants], answers: [...mail.round.answers] } : null };
}
