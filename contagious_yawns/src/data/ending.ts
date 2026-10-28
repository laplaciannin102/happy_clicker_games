/**
 * めざめ（エンディング、DESIGN.md §6.3）。条件をすべて満たすと見られる。一度きりで、そのあともゲームは続く。
 * 目標の値は scripts/endgame.sim.ts で決めた（BALANCE.md）。
 */
export const ENDING = {
  /** 冬眠の回数（季節がひとめぐり） */
  hibernations: 4,
  /** この周回の累計あくび */
  goal: 1e35,
  /** 見たあとの全生産倍率（「朝日」） */
  productionFactor: 2,
} as const;
