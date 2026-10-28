import Decimal from 'break_eternity.js';
import { LOTTERY, type LotteryReward } from '../../data/lottery';
import type { GameState } from '../../state/gameState';
import { buffMultiplier } from '../../systems/buffs';
import { addPillow } from '../../systems/pillows';
import { earn, totalRate } from '../../systems/production';
import { shardsForRun } from '../../systems/prestige';
import { nextRandom } from '../../systems/random';
import type { Minigame } from '../types';
import { evaluate, reelsFor, sanitizeHolds, type LotteryOutcome } from './logic';

/** 夢くじの費用：券の枚数。 */
export interface LotteryCost {
  tickets: number;
}

export interface LotterySession {
  seed: number;
}

/** 報酬を受け取った結果（通知の文に使う）。 */
export interface LotteryPrize extends LotteryOutcome {
  reels: string[];
  /** 'instant' で得たあくび */
  yawns: Decimal | null;
  /** 'shards' で得たかけら */
  shards: number;
  /** 'pillows' で増えたまくら */
  pillows: number;
}

/** 夢くじが遊べるか：おやすみを unlockPrestiges 回したか。 */
export function lotteryUnlocked(state: GameState): boolean {
  return state.prestige.count >= LOTTERY.unlockPrestiges;
}

/** 引いている途中の回の、今の出目と残りの回し直し回数。途中でなければ null。 */
export function currentDraw(state: GameState): { reels: string[]; respinsLeft: number } | null {
  const a = state.minigames.lottery.active;
  if (!a) return null;
  const holds = sanitizeHolds(a.holds);
  return { reels: reelsFor(a.seed, holds), respinsLeft: LOTTERY.respins - holds.length };
}

/** 回し直す：held のリールを残して、ほかを回す。回し直せたら true。 */
export function respinLottery(state: GameState, held: readonly boolean[]): boolean {
  const a = state.minigames.lottery.active;
  if (!a) return false;
  const holds = sanitizeHolds(a.holds);
  const next = sanitizeHolds([held]);
  if (holds.length >= LOTTERY.respins || next.length === 0) return false;
  a.holds = [...holds, ...next];
  return true;
}

/** ふだんの毎秒生産（流れ星などの一時的な倍率は外す）。 */
function baseRate(state: GameState): Decimal {
  return totalRate(state).div(buffMultiplier(state, 'production'));
}

function applyReward(state: GameState, reward: LotteryReward): Omit<LotteryPrize, keyof LotteryOutcome | 'reels'> {
  const prize = { yawns: null as Decimal | null, shards: 0, pillows: 0 };
  switch (reward.kind) {
    case 'production':
    case 'click':
      // 同じ種類の夢くじの効果は重ねずに置き換える
      state.buffs = state.buffs.filter((b) => !(b.source === 'lottery' && b.kind === reward.kind));
      state.buffs.push({ kind: reward.kind, factor: reward.factor, remainingMs: reward.durationMs, source: 'lottery' });
      break;
    case 'instant':
      prize.yawns = baseRate(state).mul(reward.seconds).floor();
      earn(state, prize.yawns);
      break;
    case 'pillows':
      for (let i = 0; i < reward.count; i++) if (addPillow(state)) prize.pillows += 1;
      break;
    case 'star':
      // 次の流れ星をすぐに出す（画面を見ていれば、次のフレームで流れる）
      state.stars.timerMs = 0;
      break;
    case 'shards':
      prize.shards = Math.max(1, Math.floor(shardsForRun(state) * reward.fraction));
      state.prestige.shards += prize.shards;
      state.prestige.shardsLifetime += prize.shards;
      break;
  }
  return prize;
}

/** 夢くじ（DESIGN.md §16）。結果（Result）は回し直しで残したリールの記録。 */
export const lotteryGame: Minigame<LotterySession, readonly (readonly boolean[])[], LotteryPrize | null, LotteryCost> = {
  id: 'lottery',
  unlockCondition: lotteryUnlocked,
  cost: () => ({ tickets: 1 }),

  start(state) {
    const l = state.minigames.lottery;
    if (!lotteryUnlocked(state) || l.active || l.tickets < 1) return null;
    l.tickets -= 1;
    // 出目はゲームのシードから決める。結果を見てからロードし直しても変わらない（SPEC §5）
    const seed = Math.floor(nextRandom(state) * 0x100000000) >>> 0;
    l.active = { seed, holds: [] };
    return { seed };
  },

  onFinish(state, session, holds) {
    const l = state.minigames.lottery;
    // 券を払った回でなければ何も与えない
    if (l.active?.seed !== session.seed) return null;
    l.active = null;
    const reels = reelsFor(session.seed, sanitizeHolds(holds));
    const outcome = evaluate(reels);
    l.plays += 1;
    l.runPlays += 1;
    if (outcome.match === 3) l.jackpots += 1;
    return { ...outcome, reels, ...applyReward(state, outcome.reward) };
  },
};
