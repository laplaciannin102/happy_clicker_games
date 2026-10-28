import Decimal from 'break_eternity.js';
import { ACHIEVEMENT_BONUS } from '../data/achievements';
import { SHEEP_GAME } from '../data/minigames';
import { PRODUCERS, PRODUCER_BY_ID, type ProducerId } from '../data/producers';
import type { GameState } from '../state/gameState';
import { buffMultiplier } from './buffs';
import { ownedCount, spreadSleepiness } from './chain';
import { warmthMultiplier } from './hibernation';
import { challengeProductionNow, challengeRewardProduction } from './challenges';
import { dreamProductionMultiplier, extraAchievementBonus } from './dreamTree';
import { endingMultiplier } from './ending';
import { globalMultiplier, producerMultiplier } from './upgrades';

/** あくびを獲得する（手持ち・今回の累計・全期間の累計に加える）。 */
export function earn(state: GameState, amount: Decimal): void {
  state.yawns = state.yawns.add(amount);
  state.totalYawns = state.totalYawns.add(amount);
  state.lifetime.yawns = state.lifetime.yawns.add(amount);
}

/** 実績ボーナス：1個につき +ACHIEVEMENT_BONUS（DESIGN.md §11.1）。 */
export function achievementMultiplier(state: GameState): Decimal {
  return new Decimal(1 + state.achievements.size * (ACHIEVEMENT_BONUS + extraAchievementBonus(state)));
}

/** 羊図鑑のボーナス：1種類につき +collectionBonus（DESIGN.md §10）。 */
export function collectionMultiplier(state: GameState): number {
  return 1 + state.minigames.collection.size * SHEEP_GAME.collectionBonus;
}

/** 1体あたりの生産量：基本生産 × 生産者ごとの倍率 × 全体倍率 × 実績 × 夢 × 図鑑 × ぬくもり × 朝日 × 一時的な倍率。 */
export function rateEach(state: GameState, id: ProducerId): Decimal {
  return new Decimal(PRODUCER_BY_ID[id].baseRate)
    .mul(producerMultiplier(state, id))
    .mul(globalMultiplier(state))
    .mul(achievementMultiplier(state))
    .mul(dreamProductionMultiplier(state))
    .mul(collectionMultiplier(state))
    .mul(warmthMultiplier(state))
    .mul(endingMultiplier(state))
    .mul(challengeRewardProduction(state, id))
    .mul(challengeProductionNow(state))
    .mul(buffMultiplier(state, 'production'));
}

export function producerRate(state: GameState, id: ProducerId): Decimal {
  return rateEach(state, id).mul(ownedCount(state, id));
}

export function totalRate(state: GameState): Decimal {
  return PRODUCERS.reduce((sum, def) => sum.add(producerRate(state, def.id)), new Decimal(0));
}

/** 全体の生産量に占める割合（0〜1）。 */
export function producerShare(state: GameState, id: ProducerId): number {
  const total = totalRate(state);
  if (total.lte(0)) return 0;
  return producerRate(state, id).div(total).toNumber();
}

/** dtSec 秒ぶん生産する。生産量は時間に対して一定なので、大きな dt でも結果は同じ。 */
export function produce(state: GameState, dtSec: number): void {
  if (!(dtSec > 0)) return;
  earn(state, totalRate(state).mul(dtSec));
  state.playTimeMs += dtSec * 1000;
  state.lifetime.playTimeMs += dtSec * 1000;
  spreadSleepiness(state, dtSec);
}

/** cost に届くまでの秒数。すでに届いていれば 0、生産がなければ Infinity。 */
export function secondsUntil(money: Decimal, cost: Decimal, rate: Decimal): number {
  if (money.gte(cost)) return 0;
  if (rate.lte(0)) return Infinity;
  return cost.sub(money).div(rate).toNumber();
}
