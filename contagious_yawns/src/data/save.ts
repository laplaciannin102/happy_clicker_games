/** セーブまわりの数値（SPEC §6）。 */
export const SAVE = {
  /** 署名に使う HMAC の先頭バイト数 */
  signatureBytes: 16,
  /** バックアップの世代数 */
  backupCount: 3,
  /** バックアップを1世代ずらす最短間隔。毎回ずらすと3世代とも数十秒前になってしまうため */
  backupIntervalMs: 5 * 60_000,
} as const;

/**
 * 整合性チェックのゆとり（SPEC §6.3-2）。
 * 正しく遊んだデータを誤って「改造」と判定しないよう、上限は甘めにとる。
 */
export const INTEGRITY = {
  /** 「累計 ≤ (クリック数 × クリック量 + プレイ時間 × 今の生産量) × earnSlack + earnAllowance」 */
  earnSlack: 1.5,
  earnAllowance: 100,
  /** 「クリック数 ≤ プレイ時間 × 受付上限 × clickSlack + clickAllowance」 */
  clickSlack: 1.2,
  clickAllowance: 50,
  /** 浮動小数の誤差として許す相対誤差 */
  relativeTolerance: 1e-6,
  /** 最終セーブ時刻が今よりこれ以上未来なら時計いじりとみなす */
  futureToleranceMs: 5 * 60_000,
} as const;
