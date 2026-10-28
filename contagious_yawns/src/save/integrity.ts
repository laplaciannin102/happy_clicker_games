import Decimal from 'break_eternity.js';
import { WARMTH_SHOP } from '../data/hibernation';
import { CHALLENGES } from '../data/challenges';
import { ENDING } from '../data/ending';
import { ALL_LOTTERY_REWARDS } from '../data/lottery';
import { PILLOWS, SHEEP_GAME } from '../data/minigames';
import { DREAM_NODES } from '../data/prestige';
import { INTEGRITY } from '../data/save';
import { TIMING } from '../data/economy';
import { PRODUCERS } from '../data/producers';
import type { GameState } from '../state/gameState';
import { STARS, STAR_EFFECTS } from '../data/stars';
import { inconsistentAchievements } from '../systems/achievements';
import { buffMultiplier } from '../systems/buffs';
import { challengeProductionMax, challengeProductionNow, challengeStarInterval } from '../systems/challenges';
import { chainRate, ownedCount } from '../systems/chain';
import { shardsSpent, starDurationFactor, starIntervalFactor } from '../systems/dreamTree';
import { seasonRule, warmthFor, warmthSpent } from '../systems/hibernation';
import { shardsFor, startingGrant } from '../systems/prestige';
import { clickValue } from '../systems/click';
import { totalRate } from '../systems/production';
import { bulkCost, priceMultiplier } from '../systems/purchase';
import { upgradesSpent } from '../systems/upgrades';

export type IntegrityIssue =
  /** 手持ちが累計より多い */
  | 'yawnsOverTotal'
  /** 手持ち＋生産者・アップグレードに使った額が累計より多い（買えないはずのものを持っている） */
  | 'spentOverTotal'
  /** プレイ時間と生産力・クリック数から見て、累計が多すぎる */
  | 'earnedTooFast'
  /** プレイ時間に対してクリック数が多すぎる */
  | 'clicksTooFast'
  /** 最終セーブ時刻が未来（時計いじり） */
  | 'futureSave'
  /** 作成時刻が最終セーブ時刻より後 */
  | 'createdAfterSave'
  /** プレイ時間に対して流れ星を拾った数が多すぎる */
  | 'starsTooFrequent'
  /** 全期間の記録が今回の周回より小さい */
  | 'lifetimeBelowRun'
  /** 解除済みの実績と到達記録が矛盾している */
  | 'achievementMismatch'
  /** 眠気の連鎖でうつった数が、プレイ時間に対して多すぎる */
  | 'chainTooFast'
  /** 時間とまくらの回復から見て、羊を数えた回数が多すぎる */
  | 'sheepTooFrequent'
  /** ぬくもりの収支が合わない、または記録に対して多すぎる */
  | 'warmthMismatch'
  /** 夢のかけらの収支が合わない（手持ち＋使った額 ≠ 累計） */
  | 'shardMismatch'
  /** 全期間のあくびとおやすみ回数から見て、夢のかけらが多すぎる */
  | 'shardsTooMany'
  /** おやすみの回数に対して、夢くじの券を使いすぎている */
  | 'lotteryTooMany'
  /** めざめの条件を満たしていないのに、めざめている */
  | 'endingMismatch';

/**
 * 流れ星1個で増やせる最大量。
 * rateSeconds＝「ふだんの毎秒生産 × 何秒ぶん」、clicks＝「ふだんの1クリック × 何回ぶん」。
 */
function maxStarBonus(state: GameState): { rateSeconds: number; clicks: number } {
  const durationFactor = starDurationFactor(state);
  let rateSeconds = 0;
  let clicks = 0;
  for (const { effect } of STAR_EFFECTS) {
    if (effect.kind === 'production') {
      rateSeconds = Math.max(rateSeconds, (effect.factor - 1) * (effect.durationMs / 1000) * durationFactor);
    } else if (effect.kind === 'instant') {
      rateSeconds = Math.max(rateSeconds, effect.seconds);
    } else if (effect.kind === 'click') {
      const sec = (effect.durationMs / 1000) * durationFactor;
      clicks = Math.max(clicks, (effect.factor - 1) * sec * TIMING.maxClicksPerSec);
    }
  }
  return { rateSeconds, clicks };
}

/** 夢くじ1回で増やせる最大量（流れ星と同じ形）。まくらは pillows に。 */
function maxLotteryBonus(): { rateSeconds: number; clicks: number; pillows: number } {
  let rateSeconds = 0;
  let clicks = 0;
  let pillows = 0;
  for (const r of ALL_LOTTERY_REWARDS) {
    if (r.kind === 'production') rateSeconds = Math.max(rateSeconds, (r.factor - 1) * (r.durationMs / 1000));
    else if (r.kind === 'instant') rateSeconds = Math.max(rateSeconds, r.seconds);
    else if (r.kind === 'click') clicks = Math.max(clicks, (r.factor - 1) * (r.durationMs / 1000) * TIMING.maxClicksPerSec);
    else if (r.kind === 'pillows') pillows = Math.max(pillows, r.count);
  }
  return { rateSeconds, clicks, pillows };
}

const LOTTERY_MAX = maxLotteryBonus();

/**
 * 夢のかけらの上限。1周ぶんのかけらは周回の累計で増え、周回の累計は全期間の累計を超えないので、
 * 「回数 × 全期間の累計で1周したときのかけら」を超えない。夢くじ（ふとん）1回でも、それより少ない。
 */
function maxShardsLifetime(state: GameState): number {
  const count = state.prestige.count;
  if (count === 0) return 0;
  return (count + state.minigames.lottery.plays) * (shardsFor(state.lifetime.yawns, MAX_SHARD_GAIN_FACTOR) + 1);
}

/** 夢ツリーとぬくもりショップで得られる、かけら獲得倍率の最大 */
const MAX_SHARD_GAIN_FACTOR =
  DREAM_NODES.flatMap((n) => n.effects).reduce((m, e) => (e.kind === 'shardGain' ? m * e.factor : m), 1) *
  WARMTH_SHOP.reduce((m, w) => (w.effect.kind === 'shardGain' ? m * w.effect.factor : m), 1);

/** 生産者とアップグレードに使ったあくびの合計（この周回）。 */
export function totalSpent(state: GameState): Decimal {
  return PRODUCERS.reduce(
    (sum, def) => sum.add(bulkCost(def, 0, state.producers[def.id].bought, priceMultiplier(state))),
    upgradesSpent(state),
  );
}

/**
 * 署名が通っても行う整合性チェック（SPEC §6.3-2）。
 * 生産量・クリック量は周回中に下がらないので、「今の値 × プレイ時間」は獲得量の上限になる。
 * 流れ星の一時的な効果は、拾った数 × 1個で増やせる最大量 を上限に足す。
 */
export function checkIntegrity(state: GameState, now: number): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const total = state.totalYawns;
  const tolerance = total.mul(INTEGRITY.relativeTolerance).add(1);

  if (state.yawns.gt(total.add(tolerance))) issues.push('yawnsOverTotal');
  // 夢ツリーで周回のはじめにもらったもの（生産者・持ち越し・あくび）は差し引く
  const grant = startingGrant(state);
  if (state.yawns.add(totalSpent(state)).gt(total.add(grant.spent).add(tolerance))) issues.push('spentOverTotal');

  // いま効いている一時的な倍率は外して、ふだんの値で上限を見積もる
  // 時差ボケの揺れは、いちばん大きいときの値で見積もる
  const baseRate = totalRate(state)
    .div(buffMultiplier(state, 'production'))
    .div(challengeProductionNow(state))
    .mul(challengeProductionMax(state));
  const baseClick = clickValue(state).div(buffMultiplier(state, 'click'));
  const playSec = state.playTimeMs / 1000;
  const { rateSeconds, clicks: starClicks } = maxStarBonus(state);
  const maxFromStars = baseRate.mul(rateSeconds).add(baseClick.mul(starClicks)).mul(state.stars.clicked);
  // 羊を数えたあとのクリック倍率（上限 maxFactor・buffMs）
  const sheepClicks = (SHEEP_GAME.maxFactor - 1) * (SHEEP_GAME.buffMs / 1000) * TIMING.maxClicksPerSec;
  const maxFromSheep = baseClick.mul(sheepClicks).mul(state.minigames.sheepRunPlays);
  const lotteryRuns = state.minigames.lottery.runPlays;
  const maxFromLottery = baseRate.mul(LOTTERY_MAX.rateSeconds).add(baseClick.mul(LOTTERY_MAX.clicks)).mul(lotteryRuns);
  const maxEarned = baseClick
    .mul(state.clicks)
    .add(baseRate.mul(playSec))
    .add(maxFromStars)
    .add(maxFromSheep)
    .add(maxFromLottery)
    .mul(INTEGRITY.earnSlack)
    .add(grant.yawns)
    .add(INTEGRITY.earnAllowance);
  if (total.gt(maxEarned)) issues.push('earnedTooFast');

  const maxClicks = playSec * TIMING.maxClicksPerSec * INTEGRITY.clickSlack + INTEGRITY.clickAllowance;
  if (state.clicks > maxClicks) issues.push('clicksTooFast');

  // 流れ星は最短でも minIntervalMs ごとにしか出ない（最初の1個はもっと早いことがある）
  const minStarGap =
    STARS.minIntervalMs * starIntervalFactor(state) * (seasonRule(state).starInterval ?? 1) * challengeStarInterval(state);
  // 夢くじの「流れ星」は、すぐに1個呼べる
  if (state.stars.clicked > Math.floor(state.playTimeMs / minStarGap) + 1 + lotteryRuns) {
    issues.push('starsTooFrequent');
  }

  if (state.lastSavedAt > now + INTEGRITY.futureToleranceMs) issues.push('futureSave');
  if (state.createdAt > state.lastSavedAt) issues.push('createdAfterSave');

  const { lifetime } = state;
  if (
    lifetime.yawns.add(tolerance).lt(total) ||
    lifetime.clicks < state.clicks ||
    lifetime.stars < state.stars.clicked ||
    lifetime.playTimeMs + 1 < state.playTimeMs
  ) {
    issues.push('lifetimeBelowRun');
  }
  if (inconsistentAchievements(state).length > 0) issues.push('achievementMismatch');

  // うつった数 ≤ ひとつ後ろの生産者の今の数 × 毎秒うつす数 × プレイ時間（持っている数は周回中に減らない）
  const chain = chainRate(state) * playSec;
  PRODUCERS.forEach((def, i) => {
    const next = PRODUCERS[i + 1];
    const infected = state.producers[def.id].infected;
    const max = next ? ownedCount(state, next.id).mul(chain).mul(1 + INTEGRITY.relativeTolerance).add(1) : new Decimal(0);
    if (infected.gt(max)) issues.push('chainTooFast');
  });

  // まくらは「最初の満タン ＋ 時間での回復 ＋ 流れ星 ＋ 夢くじ」でしか増えない
  const m = state.minigames;
  const maxPlays =
    PILLOWS.max + Math.floor(lifetime.playTimeMs / PILLOWS.regenMs) + lifetime.stars + m.lottery.plays * LOTTERY_MAX.pillows;
  if (m.sheepPlays > maxPlays || m.sheepRunPlays > m.sheepPlays) issues.push('sheepTooFrequent');

  // 夢くじの券は、おやすみ1回で1枚しか増えない（引いている途中の1枚も数える）
  const l = m.lottery;
  if (l.plays + l.tickets + (l.active ? 1 : 0) > state.prestige.count) issues.push('lotteryTooMany');

  const p = state.prestige;
  if (p.shards + shardsSpent(state) !== p.shardsLifetime) issues.push('shardMismatch');
  if (p.shardsLifetime > maxShardsLifetime(state)) issues.push('shardsTooMany');

  // ぬくもり：手持ち＋使った額＝これまでの合計。合計は「いちばんよかった冬眠の水準」で、その水準は「おやすみ全部のかけら」で決まる
  const h = state.hibernation;
  const maxPerHibernation = warmthFor(p.count * (shardsFor(lifetime.yawns, MAX_SHARD_GAIN_FACTOR) + 1));
  if (h.warmth + warmthSpent(state) !== h.warmthLifetime || h.warmthLifetime > (h.count > 0 ? maxPerHibernation : 0)) {
    issues.push('warmthMismatch');
  }

  // めざめは、全チャレンジのクリアと冬眠の回数が条件（どちらも減らない）
  if (state.awakenedAt !== null && (state.challenges.completed.size < CHALLENGES.length || h.count < ENDING.hibernations)) {
    issues.push('endingMismatch');
  }

  return issues;
}
