import type { ProducerId } from './producers';

/** 第1層「おやすみ」（DESIGN.md §6.1）。数値はシミュレーターで調整する（BALANCE.md）。 */
export const PRESTIGE = {
  /** おやすみできる、今回の周回の累計あくび */
  minTotal: 1.5e8,
  /** この割合に達したら「夢」タブを予告する */
  teaserRatio: 0.1,
  /**
   * 夢のかけら = floor(shardScale × (1 + log10(今回の累計 / minTotal))^logPower × 獲得倍率)
   * 累計の累乗（0.5乗・1/3乗・1/4乗）だと「かけら1個 +1%」と組み合わさって、
   * 周回ごとにかけらが倍々に増え続けた（BALANCE.md）。対数にして伸びをゆるめる。
   */
  shardScale: 10,
  logPower: 2,
  /**
   * 夢のかけらの受動ボーナス：全生産 × (1 + √累計のかけら × shardBonusCoef)。ツリーで係数が増える。
   * 当初は「1個 +1%」だったが、かけらに比例すると周回の終盤に「おやすみラッシュ」が起きた（BALANCE.md）。
   * かけら100個で +100%（当初と同じ）、それより多いと伸びがゆるやかになる。
   */
  shardBonusCoef: 0.1,
} as const;

export type DreamBranch = 'root' | 'madoromi' | 'negoto' | 'yumemi' | 'cross';

export type DreamEffect =
  /** 全生産 × factor */
  | { kind: 'production'; factor: number }
  /** クリック × factor */
  | { kind: 'click'; factor: number }
  /** クリックに毎秒生産の fraction を足す */
  | { kind: 'clickRate'; fraction: number }
  /** おやすみのあと、この生産者をこの数持って始める */
  | { kind: 'startProducer'; target: ProducerId; count: number }
  /** おやすみのあと、このあくびを持って始める */
  | { kind: 'startYawns'; amount: number }
  /** 夢のかけらの受動ボーナスの係数（√かけら あたり）を amount だけ増やす */
  | { kind: 'shardBonus'; amount: number }
  /** 眠気の連鎖を解放する（DESIGN.md §3.1） */
  | { kind: 'chain' }
  /** 実績1個あたりのボーナスを amount だけ増やす */
  | { kind: 'achievementBonus'; amount: number }
  /** この生産者を自動で買う */
  | { kind: 'autoBuy'; targets: readonly ProducerId[] }
  /** アップグレードを自動で買う */
  | { kind: 'autoUpgrade' }
  /** おやすみしてもクリック強化（工房）を持ち越す */
  | { kind: 'keepClickUpgrades' }
  /** 流れ星の間隔 × factor */
  | { kind: 'starInterval'; factor: number }
  /** 流れ星の効果時間 × factor */
  | { kind: 'starDuration'; factor: number }
  /** 流れ星が出ている時間 + ms */
  | { kind: 'starVisible'; ms: number }
  /** オフラインの上限 + ms */
  | { kind: 'offlineCap'; ms: number }
  /** オフラインの効率 + amount */
  | { kind: 'offlineEfficiency'; amount: number }
  /** 夢のかけらの獲得 × factor */
  | { kind: 'shardGain'; factor: number };

export interface DreamNodeDef {
  readonly id: string;
  readonly branch: DreamBranch;
  /** 枝の中での段（表示の並び） */
  readonly row: number;
  readonly cost: number;
  readonly requires: readonly string[];
  readonly icon: string;
  readonly effects: readonly DreamEffect[];
}

/**
 * 夢ツリー（DESIGN.md §6.1）。3本の枝：まどろみ（生産）・寝言（クリック・自動化）・夢見（流れ星・オフライン）。
 * 名前と説明は i18n 側。値段は段ごとに大きく上げる（全部で 9,503 かけら、BALANCE.md）。
 */
export const DREAM_NODES: readonly DreamNodeDef[] = [
  { id: 'root', branch: 'root', row: 0, cost: 1, requires: [], icon: '🌙', effects: [{ kind: 'production', factor: 1.5 }] },

  { id: 'm1', branch: 'madoromi', row: 1, cost: 3, requires: ['root'], icon: '🛏️', effects: [{ kind: 'production', factor: 1.5 }] },
  { id: 'm2', branch: 'madoromi', row: 2, cost: 8, requires: ['m1'], icon: '🐱', effects: [{ kind: 'startProducer', target: 'cat', count: 10 }] },
  { id: 'm3', branch: 'madoromi', row: 3, cost: 40, requires: ['m2'], icon: '📖', effects: [{ kind: 'startProducer', target: 'lecture', count: 5 }] },
  { id: 'm4', branch: 'madoromi', row: 2, cost: 15, requires: ['m1'], icon: '💤', effects: [{ kind: 'production', factor: 2 }] },
  { id: 'm5', branch: 'madoromi', row: 3, cost: 60, requires: ['m4'], icon: '🧸', effects: [{ kind: 'achievementBonus', amount: 0.01 }] },
  { id: 'm6', branch: 'madoromi', row: 4, cost: 200, requires: ['m3'], icon: '🍵', effects: [{ kind: 'startYawns', amount: 1e4 }] },
  { id: 'chain', branch: 'madoromi', row: 4, cost: 100, requires: ['m5'], icon: '🔗', effects: [{ kind: 'chain' }] },
  { id: 'm7', branch: 'madoromi', row: 4, cost: 300, requires: ['m5'], icon: '😪', effects: [{ kind: 'production', factor: 3 }] },
  { id: 'm8', branch: 'madoromi', row: 5, cost: 1000, requires: ['m6', 'm7'], icon: '👑', effects: [{ kind: 'shardBonus', amount: 0.1 }] },

  { id: 'n1', branch: 'negoto', row: 1, cost: 3, requires: ['root'], icon: '💬', effects: [{ kind: 'click', factor: 3 }] },
  { id: 'n2', branch: 'negoto', row: 2, cost: 10, requires: ['n1'], icon: '📝', effects: [{ kind: 'autoBuy', targets: ['cat', 'lecture'] }] },
  { id: 'n3', branch: 'negoto', row: 2, cost: 15, requires: ['n1'], icon: '👆', effects: [{ kind: 'clickRate', fraction: 0.03 }] },
  { id: 'n4', branch: 'negoto', row: 3, cost: 50, requires: ['n2'], icon: '📒', effects: [{ kind: 'autoBuy', targets: ['meeting', 'assembly'] }] },
  { id: 'n5', branch: 'negoto', row: 3, cost: 60, requires: ['n3'], icon: '🪡', effects: [{ kind: 'keepClickUpgrades' }] },
  {
    id: 'n6',
    branch: 'negoto',
    row: 4,
    cost: 250,
    requires: ['n4'],
    icon: '🗂️',
    effects: [{ kind: 'autoBuy', targets: ['radio', 'kotatsu', 'local_train', 'sheep'] }],
  },
  { id: 'n7', branch: 'negoto', row: 5, cost: 1000, requires: ['n5', 'n6'], icon: '🤖', effects: [{ kind: 'autoUpgrade' }] },

  { id: 'd1', branch: 'yumemi', row: 1, cost: 3, requires: ['root'], icon: '🔭', effects: [{ kind: 'starInterval', factor: 0.75 }] },
  { id: 'd2', branch: 'yumemi', row: 2, cost: 10, requires: ['d1'], icon: '🌃', effects: [{ kind: 'offlineCap', ms: 2 * 60 * 60_000 }] },
  { id: 'd3', branch: 'yumemi', row: 2, cost: 15, requires: ['d1'], icon: '☄️', effects: [{ kind: 'starDuration', factor: 1.5 }] },
  { id: 'd4', branch: 'yumemi', row: 3, cost: 50, requires: ['d2'], icon: '🏠', effects: [{ kind: 'offlineEfficiency', amount: 0.25 }] },
  { id: 'd5', branch: 'yumemi', row: 3, cost: 60, requires: ['d3'], icon: '✨', effects: [{ kind: 'starVisible', ms: 8_000 }] },
  { id: 'd6', branch: 'yumemi', row: 4, cost: 250, requires: ['d4'], icon: '📔', effects: [{ kind: 'shardGain', factor: 1.5 }] },
  {
    id: 'd7',
    branch: 'yumemi',
    row: 5,
    cost: 1000,
    requires: ['d5', 'd6'],
    icon: '🔮',
    effects: [
      { kind: 'offlineCap', ms: 2 * 60 * 60_000 },
      { kind: 'offlineEfficiency', amount: 0.25 },
    ],
  },

  { id: 'cross', branch: 'cross', row: 6, cost: 5000, requires: ['m8', 'n7', 'd7'], icon: '🌈', effects: [{ kind: 'production', factor: 5 }] },
];

export const DREAM_NODE_BY_ID: ReadonlyMap<string, DreamNodeDef> = new Map(DREAM_NODES.map((n) => [n.id, n]));

/** 自動購入・自動アップグレードの間隔（DESIGN.md §8：最初は遅い） */
export const AUTOMATION = {
  intervalMs: 1_000,
} as const;

/**
 * 夢の続き（DESIGN.md §6.4）：夢の交差点のあとに、何度でも解放できるノード。
 * n 回目の値段 = baseCost × costGrowth^(n-1)、1回ごとに全生産 × factor。冬眠でリセットされる。
 */
export const ENCORE = {
  requires: 'cross',
  icon: '🌌',
  baseCost: 10_000,
  costGrowth: 3,
  factor: 2,
  /** セーブで受け付ける上限（値段が安全な整数に収まる範囲） */
  maxLevel: 30,
} as const;
