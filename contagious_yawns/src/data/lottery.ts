/** 夢くじの絵柄（DESIGN.md §16）。並びは画面の表示順。 */
export const LOTTERY_SYMBOLS = ['moon', 'star', 'sheep', 'cloud', 'futon', 'coffee'] as const;
export type LotterySymbol = (typeof LOTTERY_SYMBOLS)[number];

export type LotteryReward =
  /** 全生産 × factor（durationMs のあいだ） */
  | { kind: 'production'; factor: number; durationMs: number }
  /** クリック × factor（durationMs のあいだ） */
  | { kind: 'click'; factor: number; durationMs: number }
  /** ふだんの毎秒生産 × seconds ぶんのあくびをすぐにもらう */
  | { kind: 'instant'; seconds: number }
  /** まくら +count（満タンより多くはならない） */
  | { kind: 'pillows'; count: number }
  /** 流れ星がすぐに流れる */
  | { kind: 'star' }
  /** 今おやすみしたらもらえる夢のかけら × fraction（最低1個） */
  | { kind: 'shards'; fraction: number };

/**
 * 夢くじ（DESIGN.md §16）：3つのリールを回し、好きなリールを残して2回まで回し直せる。
 * 券は おやすみ1回につき1枚（最大 ticketsMax 枚）。
 */
export const LOTTERY = {
  /** おやすみをこの回数したら遊べる */
  unlockPrestiges: 3,
  ticketsMax: 3,
  reels: 3,
  respins: 2,
  weights: { moon: 2, star: 2, sheep: 2, cloud: 2, futon: 1, coffee: 1 } satisfies Record<LotterySymbol, number>,
  icons: { moon: '🌙', star: '⭐', sheep: '🐑', cloud: '☁️', futon: '🛏️', coffee: '☕' } satisfies Record<LotterySymbol, string>,
} as const;

/** そろった絵柄ごとの報酬：three＝3つそろい、two＝2つそろい。 */
export const LOTTERY_REWARDS: Readonly<Record<LotterySymbol, { three: LotteryReward; two: LotteryReward }>> = {
  moon: {
    three: { kind: 'production', factor: 4, durationMs: 10 * 60_000 },
    two: { kind: 'production', factor: 2, durationMs: 5 * 60_000 },
  },
  star: {
    three: { kind: 'star' },
    two: { kind: 'click', factor: 7, durationMs: 30_000 },
  },
  sheep: {
    three: { kind: 'pillows', count: 3 },
    two: { kind: 'pillows', count: 1 },
  },
  cloud: {
    three: { kind: 'instant', seconds: 60 * 60 },
    two: { kind: 'instant', seconds: 15 * 60 },
  },
  futon: {
    three: { kind: 'shards', fraction: 0.5 },
    two: { kind: 'shards', fraction: 0.1 },
  },
  // コーヒーは「目が冴えた」：クリックが強くなる。3つそろうと大当たり
  coffee: {
    three: { kind: 'click', factor: 20, durationMs: 60_000 },
    two: { kind: 'click', factor: 3, durationMs: 30_000 },
  },
};

/** そろわなかったときのなぐさめ */
export const LOTTERY_CONSOLATION: LotteryReward = { kind: 'instant', seconds: 5 * 60 };

/** すべての報酬（整合性チェックで最大値を見積もるのに使う）。 */
export const ALL_LOTTERY_REWARDS: readonly LotteryReward[] = [
  ...Object.values(LOTTERY_REWARDS).flatMap((r) => [r.three, r.two]),
  LOTTERY_CONSOLATION,
];
