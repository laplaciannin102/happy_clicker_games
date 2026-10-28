import Decimal from 'break_eternity.js';
import type { KeyValueStore } from '../src/save/storage';
import { createInitialState, type GameState } from '../src/state/gameState';

/** 正しく遊んだ場合にありうる状態（整合性チェックを通る）。 */
export function playedState(): GameState {
  const s = createInitialState(1_700_000_000_000, 42);
  s.producers.cat.bought = 12;
  s.producers.lecture.bought = 3;
  s.clicks = 2_000;
  s.playTimeMs = 15 * 60_000;
  // 使った額 ≒ 約 290 + 約 415。手持ち 300 を足しても累計 3000 に収まる
  s.totalYawns = new Decimal(3_000);
  s.yawns = new Decimal(300);
  s.lastSavedAt = s.createdAt + s.playTimeMs;
  s.lifetime = { yawns: s.totalYawns, clicks: s.clicks, playTimeMs: s.playTimeMs, stars: 0 };
  s.achievements.set('yawns_1', s.createdAt + 60_000);
  s.achievements.set('producer_cat_1', s.createdAt + 30_000);
  s.settings = {
    notation: 'en',
    buyAmount: 'max',
    autoBuy: true,
    autoUpgrade: true,
    autoPrestige: { enabled: false, ratio: 0.5 },
    theme: 'dark',
    effects: false,
    volume: 30,
    autosaveSec: 60,
  };
  return s;
}

export function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}
