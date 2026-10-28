import Decimal from 'break_eternity.js';
import { ECONOMY } from '../data/economy';
import { PRODUCER_BY_ID, type ProducerDef, type ProducerId } from '../data/producers';
import type { BuyAmount, GameState } from '../state/gameState';
import { seasonRule } from './hibernation';
import { challengePriceMultiplier, producerAllowed } from './challenges';

const GROWTH = new Decimal(ECONOMY.priceGrowth);

/** 季節とチャレンジによる生産者の価格の倍率。 */
export function priceMultiplier(state: GameState): number {
  return (seasonRule(state).producerCost ?? 1) * challengePriceMultiplier(state);
}

/** owned 体持っているときの、次の1体の価格。mult は季節などの倍率。 */
export function unitPrice(def: ProducerDef, owned: number, mult = 1): Decimal {
  return GROWTH.pow(owned).mul(def.baseCost * mult);
}

/** owned 体持っているときに、count 体まとめて買う価格（等比数列の和）。 */
export function bulkCost(def: ProducerDef, owned: number, count: number, mult = 1): Decimal {
  if (count <= 0) return new Decimal(0);
  return unitPrice(def, owned, mult).mul(GROWTH.pow(count).sub(1)).div(GROWTH.sub(1));
}

/** money で買える最大数。 */
export function maxAffordable(def: ProducerDef, owned: number, money: Decimal, mult = 1): number {
  const first = unitPrice(def, owned, mult);
  if (money.lt(first)) return 0;
  const ratio = money.mul(GROWTH.sub(1)).div(first).add(1);
  let n = Math.floor(ratio.log10().div(GROWTH.log10()).toNumber());
  // 浮動小数の誤差で1つずれることがあるので補正する
  while (n > 0 && bulkCost(def, owned, n, mult).gt(money)) n--;
  while (bulkCost(def, owned, n + 1, mult).lte(money)) n++;
  return n;
}

/** 選択中のまとめ買い設定で、実際に買おうとする数。'max' で1体も買えなければ 0。 */
export function purchaseCount(
  def: ProducerDef,
  owned: number,
  money: Decimal,
  amount: BuyAmount,
  mult = 1,
): number {
  return amount === 'max' ? maxAffordable(def, owned, money, mult) : amount;
}

/** 表示用の数。'max' で1体も買えないときは「次の1体」を見せる。 */
export function displayCount(
  def: ProducerDef,
  owned: number,
  money: Decimal,
  amount: BuyAmount,
  mult = 1,
): number {
  return Math.max(1, purchaseCount(def, owned, money, amount, mult));
}

/** 生産者を買う。買えた数を返す（足りなければ 0 で、状態は変えない）。 */
export function buyProducer(state: GameState, id: ProducerId, amount: BuyAmount): number {
  if (!producerAllowed(state, id)) return 0;
  const def = PRODUCER_BY_ID[id];
  const owned = state.producers[id].bought;
  const mult = priceMultiplier(state);
  const count = purchaseCount(def, owned, state.yawns, amount, mult);
  if (count <= 0) return 0;
  const cost = bulkCost(def, owned, count, mult);
  if (cost.gt(state.yawns)) return 0;
  state.yawns = state.yawns.sub(cost);
  state.producers[id].bought += count;
  return count;
}
