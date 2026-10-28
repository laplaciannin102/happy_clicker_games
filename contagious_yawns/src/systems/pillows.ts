import { PILLOWS } from '../data/minigames';
import type { GameState } from '../state/gameState';

/** 羊を数える（ミニゲーム）が遊べるか：おやすみを1回したか、羊の群れを持っている。 */
export function sheepUnlocked(state: GameState): boolean {
  return state.prestige.count > 0 || state.producers.sheep.bought > 0;
}

/** まくら（チケット）を時間で回復する。満タンのあいだは時間を止める。オフラインの時間にも使う。 */
export function tickPillows(state: GameState, dtMs: number): void {
  const m = state.minigames;
  if (m.pillows >= PILLOWS.max || !(dtMs > 0)) {
    m.pillowTimerMs = Math.min(m.pillowTimerMs, PILLOWS.regenMs);
    return;
  }
  m.pillowTimerMs -= dtMs;
  while (m.pillowTimerMs <= 0 && m.pillows < PILLOWS.max) {
    m.pillows += 1;
    m.pillowTimerMs += PILLOWS.regenMs;
  }
  if (m.pillows >= PILLOWS.max) m.pillowTimerMs = PILLOWS.regenMs;
}

/** まくらを増やす（流れ星「羊が迷い込む」）。満タンなら増えない。増えたら true。 */
export function addPillow(state: GameState): boolean {
  const m = state.minigames;
  if (m.pillows >= PILLOWS.max) return false;
  m.pillows += 1;
  if (m.pillows >= PILLOWS.max) m.pillowTimerMs = PILLOWS.regenMs;
  return true;
}
