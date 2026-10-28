import type Decimal from 'break_eternity.js';
import { OFFLINE } from '../data/economy';
import type { GameState } from '../state/gameState';
import { earn, totalRate } from './production';
import { buffMultiplier, tickBuffs } from './buffs';
import { spreadSleepiness } from './chain';
import { seasonRule } from './hibernation';
import { challengeOfflineEfficiency } from './challenges';
import { tickPillows } from './pillows';
import { extraOfflineCapMs, extraOfflineEfficiency } from './dreamTree';

export interface OfflineResult {
  /** 実際にはなれていた時間 */
  awayMs: number;
  /** 数えた時間（上限でクランプ済み） */
  countedMs: number;
  gained: Decimal;
  capped: boolean;
}

/** オフライン進行の上限（夢ツリーで伸びる）。 */
export function offlineCapMs(state: GameState): number {
  return OFFLINE.capMs + extraOfflineCapMs(state) + (seasonRule(state).offlineCapMs ?? 0);
}

/** オフライン進行の効率（夢ツリーで上がる。最大 1）。 */
export function offlineEfficiency(state: GameState): number {
  const extra = extraOfflineEfficiency(state) + (seasonRule(state).offlineEfficiency ?? 0) + challengeOfflineEfficiency(state);
  return Math.min(1, OFFLINE.efficiency + extra);
}

/**
 * はなれていたあいだの生産をまとめて加える（DESIGN.md §11.2）。
 * 時計が戻っていたら 0、進みすぎていたら上限でクランプする（SPEC §6.3-2）。
 * 一時的な倍率（流れ星）はオフラインの生産には効かず、時間だけ過ぎる。
 */
export function applyOffline(state: GameState, awayMs: number): OfflineResult {
  const away = Number.isFinite(awayMs) ? Math.max(0, awayMs) : 0;
  const cap = offlineCapMs(state);
  const countedMs = Math.min(away, cap);

  const baseRate = totalRate(state).div(buffMultiplier(state, 'production'));
  const gained = baseRate.mul((countedMs / 1000) * offlineEfficiency(state));
  tickBuffs(state, away);
  // 眠気の連鎖も、生産と同じ効率で進む
  spreadSleepiness(state, (countedMs / 1000) * offlineEfficiency(state));
  tickPillows(state, away);
  earn(state, gained);
  state.playTimeMs += countedMs;
  state.lifetime.playTimeMs += countedMs;

  return { awayMs: away, countedMs, gained, capped: away > cap };
}
