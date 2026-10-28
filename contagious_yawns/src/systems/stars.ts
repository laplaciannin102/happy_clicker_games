import Decimal from 'break_eternity.js';
import { STARS, STAR_EFFECTS, STAR_EFFECT_BY_ID, type StarEffectId } from '../data/stars';
import type { GameState } from '../state/gameState';
import { earn, totalRate } from './production';
import { extraStarVisibleMs, starDurationFactor, starIntervalFactor } from './dreamTree';
import { seasonRule } from './hibernation';
import { challengeStarInterval, starsDisabled } from './challenges';
import { addPillow, sheepUnlocked } from './pillows';
import { pickWeighted, randomBetween } from './random';

/** 流れ星を出す。効果・位置・次の間隔はここで乱数から決まり、状態に保存される。 */
function spawnStar(state: GameState): void {
  // 羊が迷い込む（まくら）はミニゲームを解放してから
  const unlocked = sheepUnlocked(state);
  const effect = pickWeighted(state, STAR_EFFECTS.filter((e) => unlocked || e.effect.kind !== 'pillow')).id;
  const x = randomBetween(state, STARS.xRange[0], STARS.xRange[1]);
  const y = randomBetween(state, STARS.yRange[0], STARS.yRange[1]);
  state.stars.active = { effect, x, y, remainingMs: STARS.visibleMs + extraStarVisibleMs(state) };
  const factor = starIntervalFactor(state) * (seasonRule(state).starInterval ?? 1) * challengeStarInterval(state);
  state.stars.timerMs = randomBetween(state, STARS.minIntervalMs * factor, STARS.maxIntervalMs * factor);
}

/**
 * 流れ星の時間を進める。画面が見えていないときは進めない（放置中は出ない、DESIGN.md §9）。
 * 出ているあいだは次の星までの時間は止まる。
 */
export function tickStars(state: GameState, dtMs: number, visible: boolean): void {
  if (!visible) return;
  // 「目覚まし時計だらけ」では流れ星が出ない
  if (starsDisabled(state)) {
    state.stars.active = null;
    return;
  }
  const s = state.stars;
  if (s.active) {
    s.active.remainingMs -= dtMs;
    if (s.active.remainingMs <= 0) s.active = null;
    return;
  }
  s.timerMs -= dtMs;
  if (s.timerMs <= 0) spawnStar(state);
}

export interface StarResult {
  effect: StarEffectId;
  /** 'instant' のときに得たあくび */
  gained: Decimal | null;
  /** 'pillow' のときに、まくらが増えたか（満タンなら増えない） */
  pillow?: boolean;
}

/** 出ている流れ星を拾う。出ていなければ null。 */
export function catchStar(state: GameState): StarResult | null {
  const active = state.stars.active;
  if (!active) return null;
  state.stars.active = null;
  state.stars.clicked += 1;
  state.lifetime.stars += 1;

  const { effect } = STAR_EFFECT_BY_ID[active.effect];
  switch (effect.kind) {
    case 'production':
    case 'click':
      // 同じ効果をもう一度引いたら、重ねずに時間を延ばす
      state.buffs = state.buffs.filter((b) => b.source !== active.effect);
      state.buffs.push({
        kind: effect.kind,
        factor: effect.factor,
        remainingMs: effect.durationMs * starDurationFactor(state),
        source: active.effect,
      });
      return { effect: active.effect, gained: null };
    case 'instant': {
      const byRate = totalRate(state).mul(effect.seconds);
      const cap = state.yawns.mul(effect.capFraction);
      const gained = Decimal.min(byRate, cap);
      earn(state, gained);
      return { effect: active.effect, gained };
    }
    case 'pillow':
      return { effect: active.effect, gained: null, pillow: addPillow(state) };
  }
}
