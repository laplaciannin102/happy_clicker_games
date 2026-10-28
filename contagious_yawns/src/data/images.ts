/** 画像の種類（src/assets/images/<種類>/<ID>.png。docs/ASSETS.md）。 */
export const ICON_KINDS = [
  'main',
  'producers',
  'upgrades',
  'achievements',
  'dream',
  'warmth',
  'challenges',
  'stars',
  'sheep',
  'lottery',
] as const;
export type IconKind = (typeof ICON_KINDS)[number];

/** 縮小したときの一辺（px）。メインキャラクターだけ大きく表示するので大きめ */
export const ICON_SIZE: Readonly<Record<IconKind, number>> = {
  main: 512,
  producers: 128,
  upgrades: 128,
  achievements: 128,
  dream: 128,
  warmth: 128,
  challenges: 128,
  stars: 128,
  sheep: 128,
  lottery: 128,
};
