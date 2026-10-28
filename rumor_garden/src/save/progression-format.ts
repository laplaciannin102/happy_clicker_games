import Decimal from 'break_eternity.js';
import { producers } from '../data/balance';
import { challengeIds, type ChallengeId } from '../data/myth';
import type { AutomationState, MythState, ChallengeState } from '../state/progression';
import { isRecord } from './migrations';

function integer(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }
function keys(data: Record<string, unknown>, allowed: string[]) { return Object.keys(data).every(key => allowed.includes(key)); }
export function savedDecimal(value: unknown): Decimal {
  if (typeof value !== 'string' || value.length > 10000) throw new Error('Invalid progression number');
  const n = new Decimal(value);
  if (!n.isFinite() || n.lt(0) || n.toString() !== value) throw new Error('Invalid progression number');
  return n;
}
export function decimalArray(value: unknown): Decimal[] {
  if (!Array.isArray(value) || value.length !== producers.length) throw new Error('Invalid generated array');
  return value.map(savedDecimal);
}
export function parseMyth(value: unknown): MythState {
  if (!isRecord(value) || !integer(value.count) || !integer(value.archivedPrestiges) ||
    !keys(value, ['count', 'archivedPoints', 'archivedPrestiges'])) throw new Error('Invalid myth');
  return { count: value.count, archivedPoints: savedDecimal(value.archivedPoints), archivedPrestiges: value.archivedPrestiges };
}
export function parseChallenge(value: unknown): ChallengeState {
  if (!isRecord(value) || (value.active !== null && !challengeIds.includes(value.active as ChallengeId)) ||
    !Array.isArray(value.completed) || !value.completed.every(id => challengeIds.includes(id as ChallengeId)) ||
    new Set(value.completed).size !== value.completed.length || !keys(value, ['active', 'completed'])) throw new Error('Invalid challenge');
  return { active: value.active as ChallengeId | null, completed: [...value.completed] as ChallengeId[] };
}
export function parseAutomation(value: unknown): AutomationState {
  if (!isRecord(value) || typeof value.purchase !== 'boolean' || typeof value.research !== 'boolean' ||
    typeof value.prestige !== 'boolean' || !Array.isArray(value.targets) || value.targets.length !== producers.length ||
    !value.targets.every(v => typeof v === 'boolean') || !Array.isArray(value.order) || value.order.length !== producers.length ||
    !value.order.every(v => integer(v) && v < producers.length) || new Set(value.order).size !== producers.length ||
    typeof value.elapsed !== 'number' || !Number.isFinite(value.elapsed) || value.elapsed < 0 || value.elapsed >= 1 ||
    !keys(value, ['purchase', 'research', 'prestige', 'targets', 'order', 'reserve', 'threshold', 'elapsed'])) throw new Error('Invalid automation');
  const threshold = savedDecimal(value.threshold);
  if (threshold.lt(1) || !threshold.eq(threshold.floor())) throw new Error('Invalid auto prestige threshold');
  return { purchase: value.purchase, research: value.research, prestige: value.prestige, targets: [...value.targets],
    order: [...value.order], reserve: savedDecimal(value.reserve), threshold, elapsed: value.elapsed };
}
