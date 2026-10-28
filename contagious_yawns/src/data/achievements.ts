import { PRODUCERS, type ProducerId } from './producers';

export type AchievementCondition =
  /** 全期間の累計あくび */
  | { kind: 'lifetimeYawns'; amount: number }
  /** 毎秒のあくび */
  | { kind: 'rate'; amount: number }
  /** 全期間のクリック数 */
  | { kind: 'lifetimeClicks'; count: number }
  /** 1種類の生産者の所持数 */
  | { kind: 'owned'; target: ProducerId; count: number }
  /** 生産者の合計所持数 */
  | { kind: 'ownedTotal'; count: number }
  /** 買ったアップグレードの数 */
  | { kind: 'upgrades'; count: number }
  /** 全期間で拾った流れ星の数 */
  | { kind: 'lifetimeStars'; count: number }
  /** おやすみした回数 */
  | { kind: 'prestigeCount'; count: number }
  /** クリアしたチャレンジの数 */
  | { kind: 'challenges'; count: number }
  /** 冬眠した回数 */
  | { kind: 'hibernationCount'; count: number }
  /** 羊を数えた回数（全期間） */
  | { kind: 'sheepPlays'; count: number }
  /** 羊図鑑に登録した数 */
  | { kind: 'sheepCollection'; count: number }
  /** 夢くじを引いた回数（全期間） */
  | { kind: 'lotteryPlays'; count: number }
  /** 夢くじで3つそろった回数 */
  | { kind: 'lotteryJackpots'; count: number }
  /** 夢の続きの段階 */
  | { kind: 'encore'; level: number }
  /** めざめ（エンディング）を見た */
  | { kind: 'awakened' }
  /** 操作や時刻など、状態からは判定できないもの（コードから解除する） */
  | { kind: 'event' };

export type AchievementGroup =
  | 'yawns'
  | 'rate'
  | 'clicks'
  | 'producer'
  | 'ownedTotal'
  | 'upgrades'
  | 'stars'
  | 'prestige'
  | 'hibernation'
  | 'challenge'
  | 'sheep'
  | 'lottery'
  | 'ending'
  | 'hidden';

export interface AchievementDef {
  readonly id: string;
  readonly group: AchievementGroup;
  /** グループ内の番号（名前の引き方に使う） */
  readonly index: number;
  /** 隠し実績：解除するまで名前も条件も見せない */
  readonly hidden: boolean;
  readonly icon: string;
  readonly condition: AchievementCondition;
}

function series(
  group: AchievementGroup,
  icon: string,
  values: readonly number[],
  condition: (v: number) => AchievementCondition,
): AchievementDef[] {
  return values.map((v, index) => ({
    id: `${group}_${index + 1}`,
    group,
    index,
    hidden: false,
    icon,
    condition: condition(v),
  }));
}

const yawns = series(
  'yawns',
  '🥱',
  [1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e12, 1e14, 1e16, 1e18, 1e21],
  (amount) => ({ kind: 'lifetimeYawns', amount }),
);

const rate = series('rate', '💤', [10, 100, 1e3, 1e4, 1e5, 1e6, 1e8, 1e10], (amount) => ({
  kind: 'rate',
  amount,
}));

const clicks = series('clicks', '👆', [100, 1_000, 5_000, 20_000, 100_000], (count) => ({
  kind: 'lifetimeClicks',
  count,
}));

/** 生産者ごと：1体目と、この数 */
const PRODUCER_MILESTONES = [1, 50] as const;

const producers: AchievementDef[] = PRODUCERS.flatMap((p, pi) =>
  PRODUCER_MILESTONES.map((count, mi) => ({
    id: `producer_${p.id}_${count}`,
    group: 'producer' as const,
    index: pi * PRODUCER_MILESTONES.length + mi,
    hidden: false,
    icon: p.icon,
    condition: { kind: 'owned' as const, target: p.id, count },
  })),
);

const ownedTotal = series('ownedTotal', '🛌', [100, 250, 500], (count) => ({ kind: 'ownedTotal', count }));

const upgrades = series('upgrades', '🧵', [10, 25, 50, 100], (count) => ({ kind: 'upgrades', count }));

const stars = series('stars', '🌠', [1, 10, 50], (count) => ({ kind: 'lifetimeStars', count }));

const prestige = series('prestige', '🌙', [1, 5, 25], (count) => ({ kind: 'prestigeCount', count }));

const hibernation = series('hibernation', '🐻', [1, 4, 10], (count) => ({ kind: 'hibernationCount', count }));

const challenge = series('challenge', '🌙', [1, 4, 8], (count) => ({ kind: 'challenges', count }));

const sheep = [
  ...series('sheep', '🐑', [1, 10, 50], (count) => ({ kind: 'sheepPlays', count })),
  { id: 'sheep_collection', group: 'sheep' as const, index: 3, hidden: false, icon: '📒', condition: { kind: 'sheepCollection' as const, count: 5 } },
];

const lottery: AchievementDef[] = [
  ...series('lottery', '🎰', [1, 10, 50], (count) => ({ kind: 'lotteryPlays', count })),
  { id: 'lottery_jackpot', group: 'lottery', index: 3, hidden: false, icon: '🌟', condition: { kind: 'lotteryJackpots', count: 1 } },
];

/** 終盤：夢の続きと、めざめ（DESIGN.md §6.3・§6.4） */
const ending: AchievementDef[] = [
  { id: 'ending_encore', group: 'ending', index: 0, hidden: false, icon: '🌌', condition: { kind: 'encore', level: 5 } },
  { id: 'ending_awaken', group: 'ending', index: 1, hidden: false, icon: '🌅', condition: { kind: 'awakened' } },
];

/** 隠し実績（DESIGN.md §11.1）。条件の細かい値は HIDDEN_RULES に置く */
const HIDDEN: readonly { id: string; icon: string; condition: AchievementCondition }[] = [
  { id: 'idle_nap', icon: '😴', condition: { kind: 'event' } },
  { id: 'night_owl', icon: '🦉', condition: { kind: 'event' } },
  { id: 'fast_yawner', icon: '⚡', condition: { kind: 'event' } },
  { id: 'long_sleep', icon: '🌅', condition: { kind: 'event' } },
  { id: 'cat_lover', icon: '🐈', condition: { kind: 'owned', target: 'cat', count: 100 } },
  { id: 'nidone', icon: '🛌', condition: { kind: 'event' } },
  { id: 'miscount', icon: '🐏', condition: { kind: 'event' } },
  { id: 'wide_awake', icon: '☕', condition: { kind: 'event' } },
];

const hidden: AchievementDef[] = HIDDEN.map((h, index) => ({ ...h, group: 'hidden', index, hidden: true }));

export const HIDDEN_RULES = {
  /** 寝落ち：この時間なにも操作しない（画面は開いたまま） */
  idleNapMs: 5 * 60_000,
  /** 夜更かし：この時刻（ローカル、時）の範囲で遊ぶ。[開始, 終了) */
  nightOwlHours: [2, 4] as const,
  /** 早口：windowMs の間にこの回数クリックする */
  fastYawnClicks: 15,
  fastYawnWindowMs: 1_000,
  /** 寝る子は育つ：これ以上はなれてから戻る */
  longSleepMs: 8 * 60 * 60_000,
  /** 二度寝：おやすみしたあと、この時間なにも操作しない */
  nidoneMs: 60_000,
  /** 数え間違い：羊を数えるで、黒い羊だけをこの数以上数える（ほかは0） */
  miscountBlack: 3,
} as const;

/** すべての実績（DESIGN.md §11.1）。 */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  ...yawns,
  ...rate,
  ...clicks,
  ...producers,
  ...ownedTotal,
  ...upgrades,
  ...stars,
  ...prestige,
  ...hibernation,
  ...challenge,
  ...sheep,
  ...lottery,
  ...ending,
  ...hidden,
];

export const ACHIEVEMENT_BY_ID: ReadonlyMap<string, AchievementDef> = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

/** 実績1個あたりの全生産ボーナス（+1%） */
export const ACHIEVEMENT_BONUS = 0.01;
