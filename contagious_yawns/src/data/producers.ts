export const PRODUCER_IDS = [
  'cat',
  'lecture',
  'meeting',
  'assembly',
  'radio',
  'kotatsu',
  'local_train',
  'sheep',
  'moon',
  'front',
  'galaxy',
  'big_yawn',
] as const;
export type ProducerId = (typeof PRODUCER_IDS)[number];

export interface ProducerDef {
  readonly id: ProducerId;
  /** 1体目の価格（あくび） */
  readonly baseCost: number;
  /** 1体あたりの基本生産量（あくび/秒） */
  readonly baseRate: number;
  /** 画像がそろうまでのプレースホルダー */
  readonly icon: string;
}

/**
 * 生産者の定義（DESIGN.md §3）。並び順＝解放順。名前と説明文は i18n 側。
 * 回収時間（価格 ÷ 生産量）は上位ほど長い：100秒 → 約6,700秒。
 */
export const PRODUCERS: readonly ProducerDef[] = [
  { id: 'cat', baseCost: 10, baseRate: 0.1, icon: '🐱' },
  { id: 'lecture', baseCost: 120, baseRate: 1, icon: '📖' },
  { id: 'meeting', baseCost: 1_500, baseRate: 9, icon: '💼' },
  { id: 'assembly', baseCost: 2e4, baseRate: 80, icon: '🎤' },
  { id: 'radio', baseCost: 3e5, baseRate: 800, icon: '📻' },
  { id: 'kotatsu', baseCost: 5e6, baseRate: 9_000, icon: '🍊' },
  { id: 'local_train', baseCost: 9e7, baseRate: 1.1e5, icon: '🚃' },
  { id: 'sheep', baseCost: 1.8e9, baseRate: 1.5e6, icon: '🐑' },
  { id: 'moon', baseCost: 4e10, baseRate: 2.2e7, icon: '🌙' },
  { id: 'front', baseCost: 1e12, baseRate: 3.6e8, icon: '☁️' },
  { id: 'galaxy', baseCost: 3e13, baseRate: 7e9, icon: '🌌' },
  { id: 'big_yawn', baseCost: 1e15, baseRate: 1.5e11, icon: '💫' },
];

export const PRODUCER_BY_ID = Object.fromEntries(PRODUCERS.map((def) => [def.id, def])) as Record<
  ProducerId,
  ProducerDef
>;
