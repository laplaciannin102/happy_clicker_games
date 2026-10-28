import { ECONOMY } from '../data/economy';
import { PRODUCERS, type ProducerId } from '../data/producers';
import type { GameState } from '../state/gameState';
import { producerAllowed } from './challenges';

/** visible＝買える行として表示 / teaser＝「???」で予告 / hidden＝まだ出さない */
export type Visibility = 'visible' | 'teaser' | 'hidden';

/**
 * 生産者の表示状態（DESIGN.md §3）。
 * 前の生産者を1体以上持つと「???」で予告し、
 * さらに累計あくびが基本価格 × revealRatio に達したら表示する。
 */
export function producerVisibility(state: GameState): Record<ProducerId, Visibility> {
  const result = {} as Record<ProducerId, Visibility>;
  let prevVisible = true;
  let prevOwned = true;
  for (const [index, def] of PRODUCERS.entries()) {
    const owned = state.producers[def.id].bought > 0;
    const reached = state.totalYawns.gte(def.baseCost * ECONOMY.revealRatio);
    let v: Visibility;
    // 「猫しかいない」では、ほかの生産者は出さない
    if (!producerAllowed(state, def.id)) {
      result[def.id] = 'hidden';
      prevVisible = false;
      prevOwned = false;
      continue;
    }
    // 最初の生産者は最初から見せる（最初の10秒で1回目の購入、SPEC §4.1）
    if (index === 0 || owned || (prevVisible && prevOwned && reached)) v = 'visible';
    else if (prevVisible && prevOwned) v = 'teaser';
    else v = 'hidden';
    result[def.id] = v;
    prevVisible = v === 'visible';
    prevOwned = owned;
  }
  return result;
}
