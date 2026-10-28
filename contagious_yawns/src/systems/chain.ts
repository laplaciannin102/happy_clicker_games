import Decimal from 'break_eternity.js';
import { CHAIN } from '../data/economy';
import { PRODUCERS, type ProducerId } from '../data/producers';
import type { GameState } from '../state/gameState';
import { hasChain } from './dreamTree';
import { seasonRule } from './hibernation';
import { challengeChain } from './challenges';

/** 持っている数：購入した数 ＋ うつった数（生産量に使う。価格は購入した数だけで決める）。 */
export function ownedCount(state: GameState, id: ProducerId): Decimal {
  const p = state.producers[id];
  return p.infected.add(p.bought);
}

/** 1体が毎秒うつす数（冬は強い）。 */
export function chainRate(state: GameState): number {
  return CHAIN.rate * (seasonRule(state).chain ?? 1) * challengeChain(state);
}

/**
 * 眠気の連鎖（DESIGN.md §3.1）：生産者 #k は毎秒、生産者 #k-1 を「持っている数 × chainRate」体うつす。
 * うつった仲間もまたうつす。順番で結果が変わらないよう、進める前の数で計算する。
 */
export function spreadSleepiness(state: GameState, dtSec: number): void {
  if (!(dtSec > 0) || !hasChain(state)) return;
  const rate = chainRate(state) * dtSec;
  const owned = PRODUCERS.map((def) => ownedCount(state, def.id));
  PRODUCERS.forEach((def, i) => {
    const source = owned[i + 1];
    if (!source || source.lte(0)) return;
    const p = state.producers[def.id];
    p.infected = p.infected.add(source.mul(rate));
  });
}
