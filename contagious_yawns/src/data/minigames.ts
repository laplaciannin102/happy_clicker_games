/** ミニゲームのチケット「まくら」（DESIGN.md §10）。時間で回復する。 */
export const PILLOWS = {
  max: 3,
  regenMs: 20 * 60_000,
} as const;

/** ふつうの羊の種類（出やすさの重み）。black は数えてはいけない、feint は跳ぶふりだけ */
export const SHEEP_KINDS = ['normal', 'slow', 'feint', 'black', 'rare'] as const;
export type SheepKind = (typeof SHEEP_KINDS)[number];

/** めずらしい羊（図鑑に登録される）。 */
export const RARE_SHEEP = ['gold', 'cloud', 'star', 'pajama', 'moon'] as const;
export type RareSheepId = (typeof RARE_SHEEP)[number];

/** 羊を数える（DESIGN.md §10）。 */
export const SHEEP_GAME = {
  /** 1回の長さ */
  durationMs: 30_000,
  /** 最初の羊が柵を越えるまで */
  firstAtMs: 1_800,
  /** 羊と羊の間隔（この範囲で一様に決める） */
  minGapMs: 700,
  maxGapMs: 1_400,
  /** 最後の羊は終了のこれだけ前までに */
  tailMs: 800,
  /** 柵の上にいると判定する幅（±） */
  windowMs: 180,
  /** 画面の左端から柵まで歩く時間（ゆっくりの羊は slowFactor 倍） */
  travelMs: 2_000,
  slowFactor: 1.6,
  weights: { normal: 60, slow: 15, feint: 10, black: 12, rare: 3 } satisfies Record<SheepKind, number>,
  /**
   * 費用：まくら1枚 ＋ 今の毎秒生産 × costSeconds ぶんのあくび（最低 costMin）。
   * 報酬：90秒間 クリック ×(1 + perScore × スコア)、上限 maxFactor（大勝ちの上限、SPEC §5）
   */
  costSeconds: 180,
  costMin: 100,
  perScore: 0.1,
  maxFactor: 6,
  buffMs: 90_000,
  /** 図鑑の1種類ごとの全生産ボーナス */
  collectionBonus: 0.02,
} as const;
