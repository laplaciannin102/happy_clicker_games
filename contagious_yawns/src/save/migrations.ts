import { PILLOWS } from '../data/minigames';
import { STARS } from '../data/stars';
import { DEFAULT_DISPLAY_SETTINGS, SCHEMA_VERSION, createLotteryState } from '../state/gameState';
import { isRecord } from './payload';

type Payload = Record<string, unknown>;

/**
 * MIGRATIONS[n] は「版 n のペイロード」を「版 n+1」に変換する。
 * 古いセーブは必ず読めるようにする（SPEC §6.2）。一度出した版の変換は消さない。
 */
const MIGRATIONS: Readonly<Record<number, (raw: Payload) => Payload>> = {
  // v1（Phase 1 の素の JSON）→ v2：中の版番号をやめ、改造フラグを足す
  1: (raw) => {
    const { v: _version, ...rest } = raw;
    return { ...rest, tainted: false };
  },
  // v2 → v3：アップグレードを足す
  2: (raw) => ({ ...raw, upgrades: [] }),
  // v3 → v4：実績と全期間の記録を足す（まだ転生がないので、今回の周回＝全期間）
  3: (raw) => ({
    ...raw,
    achievements: {},
    lifetime: { yawns: raw.totalYawns, clicks: raw.clicks, playTimeMs: raw.playTimeMs },
  }),
  // v4 → v5：流れ星と一時的な倍率を足す（最初の流れ星は早めに出す）
  4: (raw) => ({
    ...raw,
    lifetime: { ...(isRecord(raw.lifetime) ? raw.lifetime : {}), stars: 0 },
    stars: { timerMs: STARS.firstIntervalMs, active: null, clicked: 0 },
    buffs: [],
  }),
  // v5 → v6：おやすみ（第1層）と自動化の設定を足す
  5: (raw) => ({
    ...raw,
    prestige: { shards: 0, shardsLifetime: 0, count: 0, nodes: [] },
    settings: { ...(isRecord(raw.settings) ? raw.settings : {}), autoBuy: true, autoUpgrade: true },
  }),
  // v6 → v7：ミニゲーム（まくらは満タンで始める）
  6: (raw) => ({
    ...raw,
    minigames: {
      pillows: PILLOWS.max,
      pillowTimerMs: PILLOWS.regenMs,
      sheepPlays: 0,
      sheepRunPlays: 0,
      sheepBest: 0,
      collection: [],
      active: null,
    },
  }),
  // v7 → v8：眠気の連鎖でうつった数を足す
  7: (raw) => ({
    ...raw,
    producers: Object.fromEntries(
      Object.entries(isRecord(raw.producers) ? raw.producers : {}).map(([id, p]) => [
        id,
        { ...(isRecord(p) ? p : {}), infected: '0' },
      ]),
    ),
  }),
  // v8 → v9：冬眠（第2層）
  8: (raw) => ({ ...raw, hibernation: { warmth: 0, warmthLifetime: 0, count: 0, shop: [] } }),
  // v9 → v10：チャレンジとオートおやすみの設定
  9: (raw) => ({
    ...raw,
    challenges: { active: null, completed: [] },
    settings: { ...(isRecord(raw.settings) ? raw.settings : {}), autoPrestige: { enabled: false, ratio: 0.5 } },
  }),
  // v10 → v11：テーマ・演出・音量・自動セーブ間隔
  10: (raw) => ({ ...raw, settings: { ...(isRecord(raw.settings) ? raw.settings : {}), ...DEFAULT_DISPLAY_SETTINGS } }),
  // v11 → v12：夢くじ・夢の続き・めざめ。夢くじの券は、これまでのおやすみの回数ぶん（上限まで）もらう
  11: (raw) => {
    const prestige = isRecord(raw.prestige) ? raw.prestige : {};
    const count = typeof prestige.count === 'number' ? prestige.count : 0;
    return {
      ...raw,
      prestige: { ...prestige, encore: 0 },
      minigames: { ...(isRecord(raw.minigames) ? raw.minigames : {}), lottery: createLotteryState(count) },
      awakenedAt: null,
    };
  },
};

/** 版 from のペイロードを最新版に変換する。変換できなければ null。 */
export function migrate(raw: Payload, from: number): Payload | null {
  if (!Number.isInteger(from) || from < 1 || from > SCHEMA_VERSION) return null;
  let current = raw;
  for (let v = from; v < SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) return null;
    current = step(current);
  }
  return current;
}
