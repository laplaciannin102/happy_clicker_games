import type { ProducerId } from './producers';

/** チャレンジの制限（DESIGN.md §7）。 */
export type ChallengeRule =
  /** 全生産 × factor */
  | { kind: 'production'; factor: number }
  /** 流れ星が出ない */
  | { kind: 'noStars' }
  /** クリックできない（最初の猫だけ startCats 匹もらう。もらわないと何も買えず詰む） */
  | { kind: 'noClicks'; startCats: number }
  /** この生産者しか雇えない */
  | { kind: 'onlyProducers'; targets: readonly ProducerId[] }
  /** 仲間の値段 × factor */
  | { kind: 'priceMultiplier'; factor: number }
  /** 生産量が periodMs 周期で min〜max 倍に揺れる */
  | { kind: 'oscillate'; periodMs: number; min: number; max: number }
  /** 制限時間（この周回のプレイ時間） */
  | { kind: 'timeLimit'; ms: number }
  /** まくら工房が使えない */
  | { kind: 'noUpgrades' };

/** クリアの報酬（永続）。 */
export type ChallengeReward =
  | { kind: 'click'; factor: number }
  | { kind: 'starInterval'; factor: number }
  | { kind: 'offlineEfficiency'; amount: number }
  | { kind: 'producers'; targets: readonly ProducerId[]; factor: number }
  | { kind: 'priceMultiplier'; factor: number }
  | { kind: 'chain'; factor: number }
  | { kind: 'startYawns'; amount: number }
  | { kind: 'production'; factor: number };

export interface ChallengeDef {
  readonly id: string;
  readonly icon: string;
  readonly rule: ChallengeRule;
  /** 目標：この周回の累計あくび */
  readonly goal: number;
  readonly reward: ChallengeReward;
}

/** チャレンジ「眠れない夜」（DESIGN.md §7）。目標はシミュレーターで確かめる（BALANCE.md）。 */
export const CHALLENGES: readonly ChallengeDef[] = [
  { id: 'coffee', icon: '☕', rule: { kind: 'production', factor: 0.5 }, goal: 1e19, reward: { kind: 'click', factor: 1.5 } },
  { id: 'cats_only', icon: '🐈', rule: { kind: 'onlyProducers', targets: ['cat', 'lecture', 'meeting'] }, goal: 1e9, reward: { kind: 'producers', targets: ['cat', 'lecture', 'meeting'], factor: 3 } },
  { id: 'all_nighter', icon: '🌃', rule: { kind: 'noClicks', startCats: 5 }, goal: 1e19, reward: { kind: 'offlineEfficiency', amount: 0.1 } },
  { id: 'cram', icon: '📚', rule: { kind: 'timeLimit', ms: 20 * 60_000 }, goal: 1e19, reward: { kind: 'startYawns', amount: 1e8 } },
  { id: 'insomnia', icon: '👁️', rule: { kind: 'noUpgrades' }, goal: 1e16, reward: { kind: 'production', factor: 2 } },
  { id: 'alarms', icon: '⏰', rule: { kind: 'noStars' }, goal: 1e19, reward: { kind: 'starInterval', factor: 0.8 } },
  { id: 'rush_hour', icon: '🚃', rule: { kind: 'priceMultiplier', factor: 10 }, goal: 1e19, reward: { kind: 'priceMultiplier', factor: 0.9 } },
  { id: 'jet_lag', icon: '✈️', rule: { kind: 'oscillate', periodMs: 60_000, min: 0.2, max: 1.8 }, goal: 1e20, reward: { kind: 'chain', factor: 1.1 } },
];

export const CHALLENGE_BY_ID: ReadonlyMap<string, ChallengeDef> = new Map(CHALLENGES.map((c) => [c.id, c]));
