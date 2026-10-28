/** 第2層「冬眠」（DESIGN.md §6.2）。数値はシミュレーターで調整する（BALANCE.md）。 */
export const HIBERNATION = {
  /** 冬眠できるようになるノード（夢ツリーを全部埋める＝最後のノード） */
  unlockNode: 'cross',
  /**
   * ぬくもりの水準 = floor(√(累計の夢のかけら / warmthDivisor))。冬眠でもらえるのは、これまでの最高（warmthLifetime）を
   * 超えたぶんだけ。毎回同じだけもらえると、ショップの倍率で夢ツリーを数十秒で埋め直して冬眠を繰り返せた（BALANCE.md）。
   */
  warmthDivisor: 1000,
  /** これまでに得たぬくもり1つあたりの全生産ボーナス */
  bonusPerWarmth: 0.25,
} as const;

export const SEASON_IDS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type SeasonId = (typeof SEASON_IDS)[number];

/** 季節ごとのルール（DESIGN.md §6.2・§13：遊び方のルールが変わる）。書いていない項目は変わらない。 */
export interface SeasonRule {
  readonly icon: string;
  /** 流れ星の間隔 × */
  readonly starInterval?: number;
  /** おやすみ中の効率 + */
  readonly offlineEfficiency?: number;
  /** おやすみ中に数える時間の上限 + */
  readonly offlineCapMs?: number;
  /** まくら工房（アップグレード）の値段 × */
  readonly upgradeCost?: number;
  /** 生産者の値段 × */
  readonly producerCost?: number;
  /** 眠気の連鎖 × */
  readonly chain?: number;
}

export const SEASONS: Readonly<Record<SeasonId, SeasonRule>> = {
  spring: { icon: '🌸', starInterval: 0.5 },
  summer: { icon: '🌻', offlineEfficiency: 0.5, offlineCapMs: 4 * 60 * 60_000 },
  autumn: { icon: '🍁', upgradeCost: 0.5 },
  winter: { icon: '⛄', producerCost: 2, chain: 3 },
};

export type WarmthEffect =
  /** 冬眠しても、この夢ツリーのノードを残す */
  | { kind: 'keepNodes'; nodes: readonly string[] }
  /** 全生産 × factor */
  | { kind: 'production'; factor: number }
  /** 夢のかけらの獲得 × factor */
  | { kind: 'shardGain'; factor: number }
  /** オートおやすみを使えるようにする */
  | { kind: 'autoPrestige' }
  /** 自動購入・自動アップグレードを factor 倍速くする */
  | { kind: 'fastAutomation'; factor: number };

export interface WarmthItemDef {
  readonly id: string;
  readonly cost: number;
  readonly icon: string;
  readonly effect: WarmthEffect;
}

/** ぬくもりショップ（冬眠しても残る）。名前と説明は i18n 側。全部で 27 ぬくもり。 */
export const WARMTH_SHOP: readonly WarmthItemDef[] = [
  { id: 'w_entry', cost: 1, icon: '🚪', effect: { kind: 'keepNodes', nodes: ['root', 'm1', 'n1', 'd1'] } },
  { id: 'w_production', cost: 1, icon: '🔥', effect: { kind: 'production', factor: 3 } },
  { id: 'w_auto_prestige', cost: 2, icon: '🌛', effect: { kind: 'autoPrestige' } },
  { id: 'w_fast_auto', cost: 3, icon: '⏩', effect: { kind: 'fastAutomation', factor: 10 } },
  { id: 'w_shards', cost: 2, icon: '💎', effect: { kind: 'shardGain', factor: 2 } },
  { id: 'w_stars', cost: 2, icon: '☄️', effect: { kind: 'keepNodes', nodes: ['d3', 'd5'] } },
  { id: 'w_auto', cost: 3, icon: '🗂️', effect: { kind: 'keepNodes', nodes: ['n2', 'n4', 'n6'] } },
  { id: 'w_offline', cost: 3, icon: '🏠', effect: { kind: 'keepNodes', nodes: ['d2', 'd4', 'd7'] } },
  { id: 'w_chain', cost: 4, icon: '🔗', effect: { kind: 'keepNodes', nodes: ['m4', 'm5', 'chain'] } },
  { id: 'w_production2', cost: 6, icon: '☀️', effect: { kind: 'production', factor: 5 } },
];

export const WARMTH_ITEM_BY_ID: ReadonlyMap<string, WarmthItemDef> = new Map(WARMTH_SHOP.map((w) => [w.id, w]));
