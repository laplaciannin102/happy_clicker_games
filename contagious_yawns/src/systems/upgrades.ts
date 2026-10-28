import Decimal from 'break_eternity.js';
import type { ProducerId } from '../data/producers';
import {
  UPGRADES,
  UPGRADE_BY_ID,
  UPGRADE_TEASER_PROGRESS,
  type UpgradeCondition,
  type UpgradeDef,
} from '../data/upgrades';
import type { GameState } from '../state/gameState';
import { seasonRule } from './hibernation';
import { upgradesDisabled } from './challenges';

/** 解放条件の達成率（0〜1）。 */
export function conditionProgress(state: GameState, condition: UpgradeCondition): number {
  switch (condition.kind) {
    case 'owned':
      return Math.min(1, state.producers[condition.target].bought / condition.count);
    case 'ownedBoth': {
      const [a, b] = condition.targets;
      const least = Math.min(state.producers[a].bought, state.producers[b].bought);
      return Math.min(1, least / condition.count);
    }
    case 'totalYawns':
      return Math.min(1, state.totalYawns.div(condition.amount).toNumber());
    case 'clicks':
      return Math.min(1, state.clicks / condition.count);
  }
}

export type UpgradeStatus = 'bought' | 'available' | 'teaser' | 'hidden';

/** 購入済み / 買える / 「???」で予告 / まだ出さない */
export function upgradeStatus(state: GameState, def: UpgradeDef): UpgradeStatus {
  if (state.upgrades.has(def.id)) return 'bought';
  const progress = conditionProgress(state, def.condition);
  if (progress >= 1) return 'available';
  return progress >= UPGRADE_TEASER_PROGRESS ? 'teaser' : 'hidden';
}

/** 表示用：買えるものを安い順に並べ、そのあとに予告中のものを安い順に。 */
export function visibleUpgrades(state: GameState): { def: UpgradeDef; status: 'available' | 'teaser' }[] {
  const out: { def: UpgradeDef; status: 'available' | 'teaser' }[] = [];
  // 「不眠症」ではまくら工房を使えない
  if (upgradesDisabled(state)) return out;
  for (const def of UPGRADES) {
    const status = upgradeStatus(state, def);
    if (status === 'available' || status === 'teaser') out.push({ def, status });
  }
  const rank = (s: 'available' | 'teaser'): number => (s === 'available' ? 0 : 1);
  return out.sort((a, b) => rank(a.status) - rank(b.status) || a.def.cost - b.def.cost);
}

/** アップグレードの値段（秋は安い）。 */
export function upgradeCost(state: GameState, def: UpgradeDef): Decimal {
  return new Decimal(def.cost * (seasonRule(state).upgradeCost ?? 1));
}

/** アップグレードを買う。買えたら true。 */
export function buyUpgrade(state: GameState, id: string): boolean {
  const def = UPGRADE_BY_ID.get(id);
  if (!def || upgradesDisabled(state) || upgradeStatus(state, def) !== 'available') return false;
  const cost = upgradeCost(state, def);
  if (state.yawns.lt(cost)) return false;
  state.yawns = state.yawns.sub(cost);
  state.upgrades.add(id);
  return true;
}

function* boughtDefs(state: GameState): Generator<UpgradeDef> {
  for (const id of state.upgrades) {
    const def = UPGRADE_BY_ID.get(id);
    if (def) yield def;
  }
}

/** 生産者ごとの倍率（生産者強化・シナジー）。 */
export function producerMultiplier(state: GameState, id: ProducerId): Decimal {
  let m = new Decimal(1);
  for (const { effect } of boughtDefs(state)) {
    if (effect.kind === 'producer' && effect.target === id) m = m.mul(effect.factor);
    if (effect.kind === 'synergy' && effect.targets.includes(id)) m = m.mul(effect.factor);
  }
  return m;
}

/** 全体倍率。 */
export function globalMultiplier(state: GameState): Decimal {
  let m = new Decimal(1);
  for (const { effect } of boughtDefs(state)) {
    if (effect.kind === 'global') m = m.mul(effect.factor);
  }
  return m;
}

/** クリック強化の合計：固定の加算と、毎秒生産量に対する割合。 */
export function clickBonus(state: GameState): { flat: number; rateFraction: number } {
  let flat = 0;
  let rateFraction = 0;
  for (const { effect } of boughtDefs(state)) {
    if (effect.kind === 'clickFlat') flat += effect.amount;
    if (effect.kind === 'clickRate') rateFraction += effect.fraction;
  }
  return { flat, rateFraction };
}

/** 買ったアップグレードの価格の合計（整合性チェック用）。 */
export function upgradesSpent(state: GameState): Decimal {
  let sum = new Decimal(0);
  for (const def of boughtDefs(state)) sum = sum.add(upgradeCost(state, def));
  return sum;
}
