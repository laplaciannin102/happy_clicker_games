import { CHALLENGES, CHALLENGE_BY_ID, type ChallengeDef, type ChallengeReward, type ChallengeRule } from '../data/challenges';
import type { ProducerId } from '../data/producers';
import type { GameState } from '../state/gameState';

/** チャレンジが遊べるか（1回目の冬眠のあと）。 */
export function challengesUnlocked(state: GameState): boolean {
  return state.hibernation.count > 0;
}

/** 挑戦中のチャレンジ。 */
export function activeChallenge(state: GameState): ChallengeDef | null {
  const id = state.challenges.active;
  return id ? (CHALLENGE_BY_ID.get(id) ?? null) : null;
}

/** 挑戦中のチャレンジの制限（種類を指定して取り出す）。 */
export function activeRule<K extends ChallengeRule['kind']>(
  state: GameState,
  kind: K,
): Extract<ChallengeRule, { kind: K }> | null {
  const rule = activeChallenge(state)?.rule;
  return rule && rule.kind === kind ? (rule as Extract<ChallengeRule, { kind: K }>) : null;
}

/** クリアしたチャレンジの報酬（種類を指定して取り出す）。 */
function rewards<K extends ChallengeReward['kind']>(state: GameState, kind: K): Extract<ChallengeReward, { kind: K }>[] {
  const out: Extract<ChallengeReward, { kind: K }>[] = [];
  for (const id of state.challenges.completed) {
    const r = CHALLENGE_BY_ID.get(id)?.reward;
    if (r && r.kind === kind) out.push(r as Extract<ChallengeReward, { kind: K }>);
  }
  return out;
}

const product = (values: readonly number[]): number => values.reduce((m, v) => m * v, 1);

/** 挑戦中の制限による全生産倍率（時差ボケは時間で揺れる）。 */
export function challengeProductionNow(state: GameState): number {
  const fixed = activeRule(state, 'production');
  if (fixed) return fixed.factor;
  const osc = activeRule(state, 'oscillate');
  if (osc) {
    const phase = (state.playTimeMs % osc.periodMs) / osc.periodMs;
    return osc.min + ((osc.max - osc.min) * (1 - Math.cos(phase * 2 * Math.PI))) / 2;
  }
  return 1;
}

/** 挑戦中の制限による全生産倍率の最大（整合性チェック用）。 */
export function challengeProductionMax(state: GameState): number {
  const osc = activeRule(state, 'oscillate');
  if (osc) return osc.max;
  return challengeProductionNow(state);
}

/** 報酬による全生産倍率（生産者ごとの報酬を含む）。 */
export function challengeRewardProduction(state: GameState, id: ProducerId): number {
  const all = product(rewards(state, 'production').map((r) => r.factor));
  const own = product(rewards(state, 'producers').filter((r) => r.targets.includes(id)).map((r) => r.factor));
  return all * own;
}

/** 生産者の値段の倍率（制限と報酬）。 */
export function challengePriceMultiplier(state: GameState): number {
  const rule = activeRule(state, 'priceMultiplier');
  return (rule?.factor ?? 1) * product(rewards(state, 'priceMultiplier').map((r) => r.factor));
}

export function challengeClickMultiplier(state: GameState): number {
  return product(rewards(state, 'click').map((r) => r.factor));
}

export function challengeStarInterval(state: GameState): number {
  return product(rewards(state, 'starInterval').map((r) => r.factor));
}

export function challengeOfflineEfficiency(state: GameState): number {
  return rewards(state, 'offlineEfficiency').reduce((s, r) => s + r.amount, 0);
}

export function challengeChain(state: GameState): number {
  return product(rewards(state, 'chain').map((r) => r.factor));
}

export function challengeStartYawns(state: GameState): number {
  return rewards(state, 'startYawns').reduce((s, r) => s + r.amount, 0);
}

export function clicksDisabled(state: GameState): boolean {
  return activeRule(state, 'noClicks') !== null;
}

export function starsDisabled(state: GameState): boolean {
  return activeRule(state, 'noStars') !== null;
}

export function upgradesDisabled(state: GameState): boolean {
  return activeRule(state, 'noUpgrades') !== null;
}

/** この生産者を雇えるか（「猫しかいない」）。 */
export function producerAllowed(state: GameState, id: ProducerId): boolean {
  const only = activeRule(state, 'onlyProducers');
  return !only || only.targets.includes(id);
}

/** 挑戦の進み具合（0〜1）。 */
export function challengeProgress(state: GameState): number {
  const c = activeChallenge(state);
  return c ? Math.min(1, state.totalYawns.div(c.goal).toNumber()) : 0;
}

export type ChallengeCheck = { kind: 'completed' | 'failed'; id: string } | null;

/** 目標に届いたらクリア、制限時間を過ぎたら失敗にする。どちらも挑戦は終わる（周回はそのまま続く）。 */
export function checkChallenge(state: GameState): ChallengeCheck {
  const c = activeChallenge(state);
  if (!c) return null;
  if (state.totalYawns.gte(c.goal)) {
    state.challenges.completed.add(c.id);
    state.challenges.active = null;
    return { kind: 'completed', id: c.id };
  }
  const limit = activeRule(state, 'timeLimit');
  if (limit && state.playTimeMs > limit.ms) {
    state.challenges.active = null;
    return { kind: 'failed', id: c.id };
  }
  return null;
}

/** 挑戦をやめる（何ももらえない。周回はそのまま続く）。 */
export function abandonChallenge(state: GameState): void {
  state.challenges.active = null;
}

export const CHALLENGE_COUNT = CHALLENGES.length;
