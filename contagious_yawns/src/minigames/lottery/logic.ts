import { LOTTERY, LOTTERY_CONSOLATION, LOTTERY_REWARDS, LOTTERY_SYMBOLS, type LotteryReward, type LotterySymbol } from '../../data/lottery';
import { mulberry32 } from '../../core/rng';

/** くじの出目（3つのリール）。 */
export type Reels = readonly LotterySymbol[];

export interface LotteryOutcome {
  /** そろった絵柄（2つ以上そろわなければ null） */
  symbol: LotterySymbol | null;
  /** そろった数（3 / 2 / 0） */
  match: 3 | 2 | 0;
  reward: LotteryReward;
}

const TOTAL_WEIGHT = LOTTERY_SYMBOLS.reduce((sum, id) => sum + LOTTERY.weights[id], 0);

function symbolAt(r: number): LotterySymbol {
  let left = r * TOTAL_WEIGHT;
  for (const id of LOTTERY_SYMBOLS) {
    left -= LOTTERY.weights[id];
    if (left < 0) return id;
  }
  return LOTTERY_SYMBOLS[LOTTERY_SYMBOLS.length - 1] ?? 'moon';
}

/** 回し直しの指定を、ありえる形に整える（回数は respins まで、各回はリールの数ぶん）。全部残す回は数えない。 */
export function sanitizeHolds(holds: readonly (readonly unknown[])[]): boolean[][] {
  return holds
    .slice(0, LOTTERY.respins)
    .map((h) => Array.from({ length: LOTTERY.reels }, (_, i) => h[i] === true))
    .filter((h) => !h.every(Boolean));
}

/**
 * シードと「回し直しで残したリール」から、今の出目を決める（DESIGN.md §16）。
 * 乱数は最初の3つ、そのあと回し直すリールの順に1つずつ使う。同じシード・同じ選び方なら必ず同じ出目になる。
 */
export function reelsFor(seed: number, holds: readonly (readonly boolean[])[]): LotterySymbol[] {
  let s = seed >>> 0;
  const draw = (): LotterySymbol => {
    const { value, next } = mulberry32(s);
    s = next;
    return symbolAt(value);
  };
  const reels = Array.from({ length: LOTTERY.reels }, draw);
  for (const held of sanitizeHolds(holds)) {
    for (let i = 0; i < reels.length; i++) if (!held[i]) reels[i] = draw();
  }
  return reels;
}

/** 出目の判定：いちばん多くそろった絵柄で報酬が決まる。 */
export function evaluate(reels: Reels): LotteryOutcome {
  let best: LotterySymbol | null = null;
  let bestCount = 0;
  for (const id of LOTTERY_SYMBOLS) {
    const n = reels.filter((r) => r === id).length;
    if (n > bestCount) {
      best = id;
      bestCount = n;
    }
  }
  if (best && bestCount >= 3) return { symbol: best, match: 3, reward: LOTTERY_REWARDS[best].three };
  if (best && bestCount === 2) return { symbol: best, match: 2, reward: LOTTERY_REWARDS[best].two };
  return { symbol: null, match: 0, reward: LOTTERY_CONSOLATION };
}
