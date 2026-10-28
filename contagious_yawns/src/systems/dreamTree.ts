import { DREAM_NODES, DREAM_NODE_BY_ID, ENCORE, PRESTIGE, type DreamEffect, type DreamNodeDef } from '../data/prestige';
import type { ProducerId } from '../data/producers';
import type { GameState } from '../state/gameState';
import { keptNodes } from './hibernation';

export type DreamNodeStatus = 'owned' | 'available' | 'locked';

/** owned＝解放済み / available＝前提を満たしている / locked＝前提が足りない */
export function nodeStatus(state: GameState, def: DreamNodeDef): DreamNodeStatus {
  const nodes = state.prestige.nodes;
  if (nodes.has(def.id)) return 'owned';
  return def.requires.every((r) => nodes.has(r)) ? 'available' : 'locked';
}

/** 夢のかけらでノードを解放する。解放できたら true。 */
export function buyNode(state: GameState, id: string): boolean {
  const def = DREAM_NODE_BY_ID.get(id);
  if (!def || nodeStatus(state, def) !== 'available') return false;
  if (state.prestige.shards < def.cost) return false;
  state.prestige.shards -= def.cost;
  state.prestige.nodes.add(id);
  return true;
}

/** 解放済みノードの効果を、種類ごとに取り出す。 */
function effectsOf<K extends DreamEffect['kind']>(
  state: GameState,
  kind: K,
): Extract<DreamEffect, { kind: K }>[] {
  const out: Extract<DreamEffect, { kind: K }>[] = [];
  for (const id of state.prestige.nodes) {
    for (const e of DREAM_NODE_BY_ID.get(id)?.effects ?? []) {
      if (e.kind === kind) out.push(e as Extract<DreamEffect, { kind: K }>);
    }
  }
  return out;
}

const product = (factors: readonly number[]): number => factors.reduce((m, f) => m * f, 1);
const sum = (values: readonly number[]): number => values.reduce((s, v) => s + v, 0);

/** 夢のかけらの受動ボーナスの係数（√累計のかけら あたり）。 */
export function shardBonusCoef(state: GameState): number {
  return PRESTIGE.shardBonusCoef + sum(effectsOf(state, 'shardBonus').map((e) => e.amount));
}

/** 夢のかけらの受動ボーナス（全生産への上乗せの割合）。 */
export function shardBonus(state: GameState): number {
  return Math.sqrt(state.prestige.shardsLifetime) * shardBonusCoef(state);
}

/** 夢による全生産倍率：ツリーの倍率 × 夢の続き × (1 + 受動ボーナス)。 */
export function dreamProductionMultiplier(state: GameState): number {
  const tree = product(effectsOf(state, 'production').map((e) => e.factor));
  return tree * encoreMultiplier(state) * (1 + shardBonus(state));
}

/** 夢の続きを解放できるか（夢の交差点のあと）。 */
export function encoreAvailable(state: GameState): boolean {
  return state.prestige.nodes.has(ENCORE.requires) && state.prestige.encore < ENCORE.maxLevel;
}

/** 夢の続きの、次の段階の値段。 */
export function encoreCost(level: number): number {
  return ENCORE.baseCost * ENCORE.costGrowth ** level;
}

/** 夢の続きを level 段階まで解放するのに使ったかけら。 */
export function encoreSpent(level: number): number {
  return (ENCORE.baseCost * (ENCORE.costGrowth ** level - 1)) / (ENCORE.costGrowth - 1);
}

export function encoreMultiplier(state: GameState): number {
  return ENCORE.factor ** state.prestige.encore;
}

/** 夢の続きを1段階解放する。できたら true。 */
export function buyEncore(state: GameState): boolean {
  const p = state.prestige;
  const cost = encoreCost(p.encore);
  if (!encoreAvailable(state) || p.shards < cost) return false;
  p.shards -= cost;
  p.encore += 1;
  return true;
}

/** 実績1個あたりのボーナスへの上乗せ。 */
export function extraAchievementBonus(state: GameState): number {
  return sum(effectsOf(state, 'achievementBonus').map((e) => e.amount));
}

export function dreamClickMultiplier(state: GameState): number {
  return product(effectsOf(state, 'click').map((e) => e.factor));
}

export function dreamClickRate(state: GameState): number {
  return sum(effectsOf(state, 'clickRate').map((e) => e.fraction));
}

export function starIntervalFactor(state: GameState): number {
  return product(effectsOf(state, 'starInterval').map((e) => e.factor));
}

export function starDurationFactor(state: GameState): number {
  return product(effectsOf(state, 'starDuration').map((e) => e.factor));
}

export function extraStarVisibleMs(state: GameState): number {
  return sum(effectsOf(state, 'starVisible').map((e) => e.ms));
}

export function extraOfflineCapMs(state: GameState): number {
  return sum(effectsOf(state, 'offlineCap').map((e) => e.ms));
}

export function extraOfflineEfficiency(state: GameState): number {
  return sum(effectsOf(state, 'offlineEfficiency').map((e) => e.amount));
}

export function shardGainFactor(state: GameState): number {
  return product(effectsOf(state, 'shardGain').map((e) => e.factor));
}

/** 自動購入できる生産者。 */
export function autoBuyTargets(state: GameState): Set<ProducerId> {
  return new Set(effectsOf(state, 'autoBuy').flatMap((e) => e.targets));
}

/** 眠気の連鎖を解放したか。 */
export function hasChain(state: GameState): boolean {
  return effectsOf(state, 'chain').length > 0;
}

export function hasAutoUpgrade(state: GameState): boolean {
  return effectsOf(state, 'autoUpgrade').length > 0;
}

export function keepsClickUpgrades(state: GameState): boolean {
  return effectsOf(state, 'keepClickUpgrades').length > 0;
}

/** おやすみのあとに持って始める生産者（同じ生産者は大きいほう）。 */
export function startingProducers(state: GameState): Map<ProducerId, number> {
  const out = new Map<ProducerId, number>();
  for (const e of effectsOf(state, 'startProducer')) {
    out.set(e.target, Math.max(out.get(e.target) ?? 0, e.count));
  }
  return out;
}

export function startingYawns(state: GameState): number {
  return sum(effectsOf(state, 'startYawns').map((e) => e.amount));
}

/** 解放したノードと夢の続きに使った夢のかけらの合計（冬眠で残したノードは払っていないので除く）。 */
export function shardsSpent(state: GameState): number {
  const kept = keptNodes(state);
  const nodes = sum([...state.prestige.nodes].filter((id) => !kept.has(id)).map((id) => DREAM_NODE_BY_ID.get(id)?.cost ?? 0));
  return nodes + encoreSpent(state.prestige.encore);
}

export const DREAM_TREE_TOTAL_COST = sum(DREAM_NODES.map((n) => n.cost));
