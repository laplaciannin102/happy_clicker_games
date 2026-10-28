import Decimal from 'break_eternity.js';
import { SHEEP_GAME, type RareSheepId } from '../../data/minigames';
import type { GameState } from '../../state/gameState';
import { buffMultiplier } from '../../systems/buffs';
import { sheepUnlocked } from '../../systems/pillows';
import { totalRate } from '../../systems/production';
import { nextRandom } from '../../systems/random';
import type { Minigame, MinigameCost } from '../types';
import { generateSheep, judge, rewardFactor, score, type Sheep, type SheepResult } from './logic';

export interface SheepSession {
  seed: number;
  sheep: Sheep[];
}

export interface SheepReward {
  result: SheepResult;
  points: number;
  /** クリック倍率（1 なら効果なし） */
  factor: number;
  /** 初めて図鑑に載った羊 */
  newRares: RareSheepId[];
  /** 自己ベストを更新したか */
  best: boolean;
}

function cost(state: GameState): MinigameCost {
  // 流れ星などの一時的な倍率は外した、ふだんの生産で決める
  const baseRate = totalRate(state).div(buffMultiplier(state, 'production'));
  return { pillows: 1, yawns: Decimal.max(SHEEP_GAME.costMin, baseRate.mul(SHEEP_GAME.costSeconds)).floor() };
}

/** 押した時刻のうち、ありえる範囲（0〜長さ）のものだけを使う。 */
function sanitize(pressesMs: readonly number[]): number[] {
  return pressesMs.filter((t) => Number.isFinite(t) && t >= 0 && t <= SHEEP_GAME.durationMs).sort((a, b) => a - b);
}

/** 羊を数える（DESIGN.md §10）。 */
export const sheepGame: Minigame<SheepSession, readonly number[], SheepReward> = {
  id: 'sheep',
  unlockCondition: sheepUnlocked,
  cost,

  start(state) {
    if (!sheepUnlocked(state)) return null;
    const price = cost(state);
    const m = state.minigames;
    if (m.pillows < price.pillows || state.yawns.lt(price.yawns)) return null;
    m.pillows -= price.pillows;
    state.yawns = state.yawns.sub(price.yawns);
    // 羊の並びはゲームのシードから決める。結果を見てからロードし直しても変わらない（SPEC §5）
    const seed = Math.floor(nextRandom(state) * 0x100000000) >>> 0;
    m.active = { seed };
    return { seed, sheep: generateSheep(seed) };
  },

  onFinish(state, session, pressesMs) {
    const m = state.minigames;
    const empty: SheepReward = {
      result: { counted: 0, mistakes: 0, rares: [], blackCounted: 0 },
      points: 0,
      factor: 1,
      newRares: [],
      best: false,
    };
    // 費用を払った回でなければ何も与えない
    if (m.active?.seed !== session.seed) return empty;
    m.active = null;

    const result = judge(session.sheep, sanitize(pressesMs));
    const points = score(result);
    const factor = rewardFactor(points);
    m.sheepPlays += 1;
    m.sheepRunPlays += 1;
    const best = points > m.sheepBest;
    if (best) m.sheepBest = points;

    const newRares = result.rares.filter((r, i) => !m.collection.has(r) && result.rares.indexOf(r) === i);
    for (const r of newRares) m.collection.add(r);

    if (factor > 1) {
      state.buffs = state.buffs.filter((b) => b.source !== 'sheep');
      state.buffs.push({ kind: 'click', factor, remainingMs: SHEEP_GAME.buffMs, source: 'sheep' });
    }
    return { result, points, factor, newRares, best };
  },
};
