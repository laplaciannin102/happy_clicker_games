import Decimal from 'break_eternity.js';
import { taleBalance as b } from '../data/tale';
import type { TaleState, TaleRound } from '../minigames/tale/state';
import { isRecord } from './migrations';

function number(value: unknown, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
}
function integer(value: unknown, max?: number): value is number { return number(value, max) && Number.isSafeInteger(value); }
export function parseTale(data: unknown): TaleState {
  if (!isRecord(data) || typeof data.unlocked !== 'boolean' || !integer(data.tickets, b.ticketCap) ||
    !number(data.recharge, b.rechargeSeconds) || data.recharge === b.rechargeSeconds ||
    !number(data.boost, b.maxPoints * b.rewardSeconds) || !integer(data.plays) || !integer(data.completed) ||
    !integer(data.wins) || !integer(data.bestPoints, b.maxPoints) || typeof data.illustration !== 'boolean' ||
    !integer(data.lastPoints, b.maxPoints) || !['none', 'banked', 'failure'].includes(String(data.lastOutcome)) ||
    typeof data.spent !== 'string' || data.spent.length > 10000) throw new Error('Invalid tale');
  const spent = new Decimal(data.spent);
  if (!spent.isFinite() || spent.lt(0) || spent.toString() !== data.spent ||
    Object.keys(data).some(key => !['unlocked', 'tickets', 'recharge', 'boost', 'spent', 'plays', 'completed',
      'wins', 'bestPoints', 'illustration', 'lastPoints', 'lastOutcome', 'round'].includes(key))) throw new Error('Invalid tale fields');
  let round: TaleRound | null = null;
  if (data.round !== null) {
    const r = data.round;
    if (!isRecord(r) || !Array.isArray(r.rolls) || r.rolls.length !== b.stages ||
      !r.rolls.every(value => number(value, 1) && value < 1) || !integer(r.stage, b.stages - 1) ||
      !integer(r.points, b.maxPoints) || !['safe', 'bold'].includes(String(r.choice)) ||
      !number(r.remaining, b.stageSeconds) || !['running', 'decision'].includes(String(r.phase)) ||
      (r.phase === 'running' && r.remaining === 0) || (r.phase === 'decision' && r.remaining !== 0) ||
      Object.keys(r).some(key => !['rolls', 'stage', 'points', 'choice', 'remaining', 'phase'].includes(key))) throw new Error('Invalid tale round');
    round = { rolls: [...r.rolls], stage: r.stage, points: r.points, choice: r.choice as TaleRound['choice'],
      remaining: r.remaining, phase: r.phase as TaleRound['phase'] };
  }
  return { unlocked: data.unlocked, tickets: data.tickets, recharge: data.recharge, boost: data.boost,
    spent, plays: data.plays, completed: data.completed, wins: data.wins, bestPoints: data.bestPoints,
    illustration: data.illustration, lastPoints: data.lastPoints, lastOutcome: data.lastOutcome as TaleState['lastOutcome'], round };
}
