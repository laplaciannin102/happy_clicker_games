import Decimal from 'break_eternity.js';
import { PRESTIGE } from '../data/prestige';
import { PRODUCER_BY_ID } from '../data/producers';
import { STARS } from '../data/stars';
import { UPGRADE_BY_ID } from '../data/upgrades';
import { createProducerStates, type GameState } from '../state/gameState';
import { earn } from './production';
import { bulkCost, priceMultiplier } from './purchase';
import { upgradeCost } from './upgrades';
import { warmthShardGain } from './hibernation';
import { activeRule, challengeStartYawns, challengesUnlocked, producerAllowed } from './challenges';
import { CHALLENGE_BY_ID } from '../data/challenges';
import { LOTTERY } from '../data/lottery';
import { keepsClickUpgrades, shardGainFactor, startingProducers, startingYawns } from './dreamTree';

/** 周回の累計 total に対する夢のかけら（獲得倍率 factor をかける前の式は PRESTIGE を参照）。 */
export function shardsFor(total: Decimal, factor: number): number {
  if (total.lt(PRESTIGE.minTotal)) return 0;
  const orders = total.div(PRESTIGE.minTotal).log10().toNumber();
  const raw = PRESTIGE.shardScale * (1 + orders) ** PRESTIGE.logPower * factor;
  // かけらは number で持つ。極端に大きい値は安全な整数の範囲に収める
  return Math.min(Math.floor(raw), Number.MAX_SAFE_INTEGER);
}

/** 今おやすみしたら得られる夢のかけら（DESIGN.md §6.1）。条件に届いていなければ 0。 */
export function shardsForRun(state: GameState): number {
  return shardsFor(state.totalYawns, shardGainFactor(state) * warmthShardGain(state));
}

export function canPrestige(state: GameState): boolean {
  return shardsForRun(state) > 0;
}

/** おやすみまでの進み具合（0〜1）。 */
export function prestigeProgress(state: GameState): number {
  return Math.min(1, state.totalYawns.div(PRESTIGE.minTotal).toNumber());
}

/** 「夢」タブを出すか：予告ラインに達したか、一度でもおやすみしたことがあるか。 */
export function dreamUnlocked(state: GameState): boolean {
  return state.prestige.count > 0 || prestigeProgress(state) >= PRESTIGE.teaserRatio;
}

/** 持ち越すアップグレード（夢ツリーで解放）。 */
function keptUpgrades(state: GameState): Set<string> {
  if (!keepsClickUpgrades(state)) return new Set();
  return new Set([...state.upgrades].filter((id) => UPGRADE_BY_ID.get(id)?.group === 'click'));
}

/**
 * 周回のはじめにもらえるもの（夢ツリーの効果）の値打ち。
 * 整合性チェックで「使った額」「獲得量」から差し引くのに使う。
 */
export function startingGrant(state: GameState): { spent: Decimal; yawns: Decimal } {
  let spent = new Decimal(0);
  const mult = priceMultiplier(state);
  for (const [id, count] of startingProducers(state)) spent = spent.add(bulkCost(PRODUCER_BY_ID[id], 0, count, mult));
  const noClicks = activeRule(state, 'noClicks');
  if (noClicks) spent = spent.add(bulkCost(PRODUCER_BY_ID.cat, 0, noClicks.startCats, mult));
  if (keepsClickUpgrades(state)) {
    for (const id of state.upgrades) {
      const def = UPGRADE_BY_ID.get(id);
      if (def?.group === 'click') spent = spent.add(upgradeCost(state, def));
    }
  }
  return { spent, yawns: new Decimal(startingYawns(state) + challengeStartYawns(state)) };
}

/**
 * おやすみ：夢のかけらと夢くじの券を得て、周回の進行をリセットする（DESIGN.md §6.1）。
 * 残るもの：夢のかけら・夢ツリー・実績・全期間の記録・設定・改造フラグ・乱数のシード。
 * 得たかけらの数を返す（できなければ 0 で、状態は変えない）。
 */
export function doPrestige(state: GameState): number {
  const gained = shardsForRun(state);
  if (gained <= 0) return 0;

  state.prestige.shards += gained;
  state.prestige.shardsLifetime += gained;
  state.prestige.count += 1;
  // 夢くじの券を1枚もらう（DESIGN.md §16）
  const lottery = state.minigames.lottery;
  lottery.tickets = Math.min(LOTTERY.ticketsMax, lottery.tickets + 1);
  // おやすみしたらチャレンジはやめたことになる
  state.challenges.active = null;
  resetRun(state);
  return gained;
}

/**
 * 周回の進行をリセットし、夢ツリーなどの「はじめにもらうもの」を与える。
 * おやすみと、チャレンジを始めるときに使う。
 */
export function resetRun(state: GameState): void {
  const kept = keptUpgrades(state);
  state.yawns = new Decimal(0);
  state.totalYawns = new Decimal(0);
  state.clicks = 0;
  state.producers = createProducerStates();
  state.upgrades = kept;
  state.buffs = [];
  state.stars = { timerMs: STARS.firstIntervalMs, active: null, clicked: 0 };
  state.playTimeMs = 0;
  state.minigames.sheepRunPlays = 0;
  state.minigames.lottery.runPlays = 0;

  for (const [id, count] of startingProducers(state)) {
    if (producerAllowed(state, id)) state.producers[id].bought = count;
  }
  // 「徹夜明け」はクリックできないので、最初の猫をもらう
  const noClicks = activeRule(state, 'noClicks');
  if (noClicks) state.producers.cat.bought = Math.max(state.producers.cat.bought, noClicks.startCats);
  const startYawns = startingYawns(state) + challengeStartYawns(state);
  if (startYawns > 0) earn(state, new Decimal(startYawns));
}

/** チャレンジを始める：周回をリセットして挑戦する。始められたら true。 */
export function startChallenge(state: GameState, id: string): boolean {
  if (!challengesUnlocked(state) || state.challenges.active !== null) return false;
  if (!CHALLENGE_BY_ID.has(id) || state.challenges.completed.has(id)) return false;
  state.challenges.active = id;
  resetRun(state);
  return true;
}
