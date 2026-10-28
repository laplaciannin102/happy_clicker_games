import Decimal from 'break_eternity.js';
import {
  HIBERNATION,
  SEASONS,
  SEASON_IDS,
  WARMTH_ITEM_BY_ID,
  type SeasonId,
  type SeasonRule,
  type WarmthEffect,
} from '../data/hibernation';
import { STARS } from '../data/stars';
import { createProducerStates, type GameState } from '../state/gameState';

/** 今の季節。まだ冬眠していなければ null（季節のルールなし）。1回目の冬眠で春になる。 */
export function currentSeason(state: GameState): SeasonId | null {
  const count = state.hibernation.count;
  return count > 0 ? (SEASON_IDS[(count - 1) % SEASON_IDS.length] ?? null) : null;
}

/** 次に冬眠したときの季節。 */
export function nextSeason(state: GameState): SeasonId {
  return SEASON_IDS[state.hibernation.count % SEASON_IDS.length] ?? 'spring';
}

const NO_RULE: SeasonRule = { icon: '' };

/** 今の季節のルール（季節がなければ何も変えない）。 */
export function seasonRule(state: GameState): SeasonRule {
  const season = currentSeason(state);
  return season ? SEASONS[season] : NO_RULE;
}

export function canHibernate(state: GameState): boolean {
  return state.prestige.nodes.has(HIBERNATION.unlockNode);
}

/** 「冬眠」タブを出すか。 */
export function hibernationUnlocked(state: GameState): boolean {
  return state.hibernation.count > 0 || canHibernate(state);
}

/** 累計の夢のかけら shardsLifetime に対応する、ぬくもりの水準。 */
export function warmthFor(shardsLifetime: number): number {
  return Math.floor(Math.sqrt(Math.max(0, shardsLifetime) / HIBERNATION.warmthDivisor));
}

/** 今冬眠したらもらえるぬくもり：水準がこれまでの最高を超えたぶん。冬眠できなければ 0。 */
export function warmthForNow(state: GameState): number {
  if (!canHibernate(state)) return 0;
  return Math.max(0, warmthFor(state.prestige.shardsLifetime) - state.hibernation.warmthLifetime);
}

/** 次のぬくもりをもらうのに必要な、累計の夢のかけら。 */
export function shardsForNextWarmth(state: GameState): number {
  const next = state.hibernation.warmthLifetime + 1;
  return next * next * HIBERNATION.warmthDivisor;
}

function* ownedEffects(state: GameState): Generator<WarmthEffect> {
  for (const id of state.hibernation.shop) {
    const def = WARMTH_ITEM_BY_ID.get(id);
    if (def) yield def.effect;
  }
}

/** ぬくもりによる全生産倍率：ショップの倍率 × (1 + これまでのぬくもり × 1つあたり)。 */
export function warmthMultiplier(state: GameState): number {
  let m = 1 + state.hibernation.warmthLifetime * HIBERNATION.bonusPerWarmth;
  for (const e of ownedEffects(state)) if (e.kind === 'production') m *= e.factor;
  return m;
}

export function warmthShardGain(state: GameState): number {
  let m = 1;
  for (const e of ownedEffects(state)) if (e.kind === 'shardGain') m *= e.factor;
  return m;
}

export function hasAutoPrestige(state: GameState): boolean {
  for (const e of ownedEffects(state)) if (e.kind === 'autoPrestige') return true;
  return false;
}

/** 自動化の速さの倍率。 */
export function automationSpeed(state: GameState): number {
  let m = 1;
  for (const e of ownedEffects(state)) if (e.kind === 'fastAutomation') m *= e.factor;
  return m;
}

/** 冬眠しても残る夢ツリーのノード。 */
export function keptNodes(state: GameState): Set<string> {
  const out = new Set<string>();
  for (const e of ownedEffects(state)) if (e.kind === 'keepNodes') for (const n of e.nodes) out.add(n);
  return out;
}

/** ぬくもりショップで買う。買えたら true。 */
export function buyWarmthItem(state: GameState, id: string): boolean {
  const def = WARMTH_ITEM_BY_ID.get(id);
  const h = state.hibernation;
  if (!def || h.shop.has(id) || h.warmth < def.cost) return false;
  h.warmth -= def.cost;
  h.shop.add(id);
  // 残すノードは、買った時点でもう持っていることにする
  if (def.effect.kind === 'keepNodes') for (const n of def.effect.nodes) state.prestige.nodes.add(n);
  return true;
}

/** ぬくもりショップに使った合計。 */
export function warmthSpent(state: GameState): number {
  let sum = 0;
  for (const id of state.hibernation.shop) sum += WARMTH_ITEM_BY_ID.get(id)?.cost ?? 0;
  return sum;
}

/**
 * 冬眠：ぬくもりを得て、第1層の進行をすべてリセットし、季節を進める（DESIGN.md §6.2）。
 * 残るもの：ぬくもり・ショップ（と、ショップで残すノード）・実績・全期間の記録・羊図鑑・設定。
 * おやすみの回数は全期間の記録として残す（実績と合わせるため）。得たぬくもりを返す（できなければ 0）。
 */
export function doHibernate(state: GameState): number {
  const gained = warmthForNow(state);
  if (!canHibernate(state)) return 0;
  const h = state.hibernation;
  h.warmth += gained;
  h.warmthLifetime += gained;
  h.count += 1;

  state.prestige.shards = 0;
  state.prestige.shardsLifetime = 0;
  state.prestige.nodes = keptNodes(state);
  state.prestige.encore = 0;

  state.yawns = new Decimal(0);
  state.totalYawns = new Decimal(0);
  state.clicks = 0;
  state.producers = createProducerStates();
  state.upgrades = new Set();
  state.buffs = [];
  state.stars = { timerMs: STARS.firstIntervalMs, active: null, clicked: 0 };
  state.playTimeMs = 0;
  state.minigames.sheepRunPlays = 0;
  state.minigames.lottery.runPlays = 0;
  state.challenges.active = null;
  return gained;
}
