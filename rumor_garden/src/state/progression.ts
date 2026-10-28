import Decimal from 'break_eternity.js';
import { producers } from '../data/balance';
import type { ChallengeId } from '../data/myth';

export interface MythState { count: number; archivedPoints: Decimal; archivedPrestiges: number }
export interface ChallengeState { active: ChallengeId | null; completed: ChallengeId[] }
export interface AutomationState {
  purchase: boolean; research: boolean; prestige: boolean;
  targets: boolean[]; order: number[]; reserve: Decimal; threshold: Decimal; elapsed: number;
}
export function createAutomation(): AutomationState {
  return { purchase: false, research: false, prestige: false, targets: producers.map(() => true),
    order: producers.map((_, i) => i), reserve: new Decimal(0), threshold: new Decimal(1), elapsed: 0 };
}
export function cloneAutomation(auto: AutomationState): AutomationState {
  return { ...auto, targets: [...auto.targets], order: [...auto.order],
    reserve: new Decimal(auto.reserve), threshold: new Decimal(auto.threshold) };
}
