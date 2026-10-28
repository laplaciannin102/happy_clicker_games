import Decimal from 'break_eternity.js';
import { mailBalance as b } from '../data/mail';
import type { MailState, MailRound } from '../minigames/mail/state';
import { isRecord } from './migrations';

const number = (v: unknown, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
const integer = (v: unknown, max = Number.MAX_SAFE_INTEGER): v is number => number(v,max) && Number.isSafeInteger(v);
const array = (v: unknown, max: number): v is number[] => Array.isArray(v) && v.every(n => integer(n,max));
export function parseMail(data: unknown): MailState {
  if (!isRecord(data) || typeof data.unlocked !== 'boolean' || typeof data.epilogueSeen !== 'boolean' ||
    !integer(data.tickets,b.ticketCap) || !number(data.recharge,b.rechargeSeconds) || data.recharge === b.rechargeSeconds ||
    !integer(data.plays) || !integer(data.completed) || !integer(data.deliveries) || !integer(data.lastCorrect,b.stages) ||
    !Array.isArray(data.postcards) || !data.postcards.every(id => typeof id === 'string' && b.postcards.some(known => known === id)) ||
    new Set(data.postcards).size !== data.postcards.length || typeof data.spent !== 'string' || data.spent.length > 10000 ||
    Object.keys(data).some(k => !['unlocked','tickets','recharge','spent','plays','completed','deliveries','lastCorrect','postcards','epilogueSeen','round'].includes(k))) throw new Error('Invalid mail');
  const spent = new Decimal(data.spent);
  if (!spent.isFinite() || spent.lt(0) || spent.toString() !== data.spent) throw new Error('Invalid mail spending');
  let round: MailRound | null = null;
  if (data.round !== null) {
    const r = data.round;
    if (!isRecord(r) || !array(r.destinations,b.destinations-1) || r.destinations.length !== b.stages ||
      !array(r.variants,b.variants-1) || r.variants.length !== b.stages || !array(r.answers,b.destinations-1) ||
      !integer(r.stage,b.stages-1) || !number(r.remaining,b.stageSeconds) ||
      !['ready','running'].includes(String(r.phase)) || (r.phase === 'ready' ? r.remaining !== 0 || r.answers.length !== r.stage
        : r.remaining === 0 || r.answers.length !== r.stage+1) ||
      Object.keys(r).some(k => !['destinations','variants','answers','stage','remaining','phase'].includes(k))) throw new Error('Invalid mail round');
    round = { destinations: [...r.destinations], variants: [...r.variants], answers: [...r.answers],
      stage: r.stage, remaining: r.remaining, phase: r.phase as MailRound['phase'] };
  }
  return { unlocked:data.unlocked,tickets:data.tickets,recharge:data.recharge,spent,plays:data.plays,completed:data.completed,
    deliveries:data.deliveries,lastCorrect:data.lastCorrect,postcards:[...data.postcards],epilogueSeen:data.epilogueSeen,round };
}
