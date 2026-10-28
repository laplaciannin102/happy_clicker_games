import { PRODUCERS, PRODUCER_BY_ID, type ProducerId } from './producers';

export type UpgradeEffect =
  /** 1種類の生産者の生産 × factor */
  | { kind: 'producer'; target: ProducerId; factor: number }
  /** 2種類の生産者の生産をどちらも × factor（シナジー） */
  | { kind: 'synergy'; targets: readonly [ProducerId, ProducerId]; factor: number }
  /** 全生産 × factor */
  | { kind: 'global'; factor: number }
  /** 1クリック + amount */
  | { kind: 'clickFlat'; amount: number }
  /** 1クリックに「毎秒の生産量 × fraction」を足す */
  | { kind: 'clickRate'; fraction: number };

export type UpgradeCondition =
  | { kind: 'owned'; target: ProducerId; count: number }
  | { kind: 'ownedBoth'; targets: readonly [ProducerId, ProducerId]; count: number }
  | { kind: 'totalYawns'; amount: number }
  | { kind: 'clicks'; count: number };

export interface UpgradeDef {
  readonly id: string;
  /** 名前・説明文の種類（i18n の引き方） */
  readonly group: 'tier' | 'click' | 'global' | 'synergy';
  /** tier のときの段（0〜） */
  readonly tier?: number;
  readonly cost: number;
  readonly icon: string;
  readonly condition: UpgradeCondition;
  readonly effect: UpgradeEffect;
}

/** 生産者強化：この所持数に達すると、その生産者 ×2 が買えるようになる（DESIGN.md §5） */
const TIER_COUNTS = [1, 10, 25, 50, 100, 150, 200] as const;
/** 生産者強化の価格（その生産者の基本価格の何倍か）。所持数 N のときの次の1体の 5〜6倍ほど */
const TIER_COST_FACTORS = [6, 25, 200, 6e3, 6e6, 7e9, 7e12] as const;
const TIER_FACTOR = 2;

const tierUpgrades: UpgradeDef[] = PRODUCERS.flatMap((p) =>
  TIER_COUNTS.map((count, tier) => ({
    id: `${p.id}_t${tier + 1}`,
    group: 'tier' as const,
    tier,
    cost: p.baseCost * (TIER_COST_FACTORS[tier] ?? 1),
    icon: p.icon,
    condition: { kind: 'owned' as const, target: p.id, count },
    effect: { kind: 'producer' as const, target: p.id, factor: TIER_FACTOR },
  })),
);

const CLICK_STEPS: readonly Omit<UpgradeDef, 'group' | 'icon'>[] = [
  { id: 'click_1', cost: 50, condition: { kind: 'clicks', count: 30 }, effect: { kind: 'clickFlat', amount: 1 } },
  { id: 'click_2', cost: 5e3, condition: { kind: 'totalYawns', amount: 1e4 }, effect: { kind: 'clickRate', fraction: 0.01 } },
  { id: 'click_3', cost: 5e5, condition: { kind: 'totalYawns', amount: 1e6 }, effect: { kind: 'clickRate', fraction: 0.02 } },
  { id: 'click_4', cost: 5e7, condition: { kind: 'totalYawns', amount: 1e8 }, effect: { kind: 'clickRate', fraction: 0.03 } },
  { id: 'click_5', cost: 5e9, condition: { kind: 'totalYawns', amount: 1e10 }, effect: { kind: 'clickRate', fraction: 0.04 } },
  { id: 'click_6', cost: 5e11, condition: { kind: 'totalYawns', amount: 1e12 }, effect: { kind: 'clickRate', fraction: 0.05 } },
];

const clickUpgrades: UpgradeDef[] = CLICK_STEPS.map((u) => ({ ...u, group: 'click', icon: '🥱' }));

/** 累計あくびの節目で買える全体倍率 */
const GLOBAL_STEPS: readonly (readonly [amount: number, factor: number])[] = [
  [5e3, 1.1],
  [5e5, 1.15],
  [5e7, 1.2],
  [5e9, 1.25],
  [5e11, 1.3],
  [5e13, 1.4],
  [5e15, 1.5],
];

const globalUpgrades: UpgradeDef[] = GLOBAL_STEPS.map(([amount, factor], i) => ({
  id: `global_${i + 1}`,
  group: 'global',
  cost: amount,
  icon: '🛏️',
  condition: { kind: 'totalYawns', amount },
  effect: { kind: 'global', factor },
}));

/** シナジー：両方をこの数ずつ持つと買える。価格は高いほうの基本価格 × SYNERGY_COST_FACTOR */
const SYNERGY_PAIRS: readonly (readonly [ProducerId, ProducerId])[] = [
  ['cat', 'kotatsu'],
  ['lecture', 'assembly'],
  ['radio', 'sheep'],
  ['moon', 'galaxy'],
];
const SYNERGY_COUNT = 15;
const SYNERGY_FACTOR = 1.5;
const SYNERGY_COST_FACTOR = 200;

const synergyUpgrades: UpgradeDef[] = SYNERGY_PAIRS.map((targets) => {
  const expensive = Math.max(PRODUCER_BY_ID[targets[0]].baseCost, PRODUCER_BY_ID[targets[1]].baseCost);
  return {
    id: `synergy_${targets[0]}_${targets[1]}`,
    group: 'synergy',
    cost: expensive * SYNERGY_COST_FACTOR,
    icon: '🤝',
    condition: { kind: 'ownedBoth', targets, count: SYNERGY_COUNT },
    effect: { kind: 'synergy', targets, factor: SYNERGY_FACTOR },
  };
});

/** すべてのアップグレード（DESIGN.md §5）。 */
export const UPGRADES: readonly UpgradeDef[] = [
  ...clickUpgrades,
  ...globalUpgrades,
  ...tierUpgrades,
  ...synergyUpgrades,
];

export const UPGRADE_BY_ID: ReadonlyMap<string, UpgradeDef> = new Map(UPGRADES.map((u) => [u.id, u]));

/** 「???」で予告し始める、解放条件の達成率 */
export const UPGRADE_TEASER_PROGRESS = 0.5;
