/** 流れ星（DESIGN.md §9）。画面を見ているあいだだけ時間が進む。 */
export const STARS = {
  /** 最初の1個（はじめて遊ぶ人に早めに見せる） */
  firstIntervalMs: 4 * 60_000,
  /** 2個目以降の間隔：この範囲で一様に決める */
  minIntervalMs: 3 * 60_000,
  maxIntervalMs: 5 * 60_000,
  /** 画面に出ている時間 */
  visibleMs: 12_000,
  /** 出現位置（画面に対する割合）の範囲 */
  xRange: [0.08, 0.82] as const,
  yRange: [0.15, 0.7] as const,
} as const;

export const STAR_EFFECT_IDS = ['wish', 'rest', 'big_yawn', 'stray_sheep'] as const;
export type StarEffectId = (typeof STAR_EFFECT_IDS)[number];

export type StarEffect =
  /** 一定時間、全生産 × factor */
  | { kind: 'production'; factor: number; durationMs: number }
  /** 一定時間、クリック × factor */
  | { kind: 'click'; factor: number; durationMs: number }
  /** 今の生産 seconds 秒ぶんをすぐ得る（上限：手持ちの capFraction） */
  | { kind: 'instant'; seconds: number; capFraction: number }
  /** ミニゲームのチケット「まくら」 + 1（ミニゲームを解放するまでは出ない） */
  | { kind: 'pillow' };

export interface StarEffectDef {
  readonly id: StarEffectId;
  readonly weight: number;
  readonly effect: StarEffect;
}

/** 流れ星の効果と出やすさ。 */
export const STAR_EFFECTS: readonly StarEffectDef[] = [
  { id: 'wish', weight: 45, effect: { kind: 'production', factor: 7, durationMs: 60_000 } },
  { id: 'rest', weight: 35, effect: { kind: 'instant', seconds: 15 * 60, capFraction: 0.15 } },
  { id: 'big_yawn', weight: 20, effect: { kind: 'click', factor: 77, durationMs: 10_000 } },
  { id: 'stray_sheep', weight: 15, effect: { kind: 'pillow' } },
];

export const STAR_EFFECT_BY_ID = Object.fromEntries(STAR_EFFECTS.map((e) => [e.id, e])) as Record<
  StarEffectId,
  StarEffectDef
>;
