import { HIDDEN_RULES } from '../data/achievements';

/**
 * 状態からは判定できない隠し実績（寝落ち・夜更かし・早口・寝る子は育つ・二度寝）のための記録。
 * DOM には触らない。呼び出し側が操作や時刻を渡す。
 */
export interface ActivityTracker {
  /** 何か操作した（クリック・キー・タップ、画面に戻ってきたときも） */
  input(now: number): void;
  /** あくびボタンを押した（受け付けたクリックだけ） */
  click(now: number): void;
  /** はなれていた時間 */
  away(ms: number): void;
  /** おやすみした */
  prestiged(now: number): void;
  /** 解除してよい実績 ID を返す。visible＝画面が見えているか、hour＝ローカル時刻の時 */
  poll(now: number, visible: boolean, hour: number): string[];
}

export function createActivityTracker(startAt: number): ActivityTracker {
  let lastInput = startAt;
  const recentClicks: number[] = [];
  let pending: string[] = [];
  let prestigedAt: number | null = null;

  return {
    input(now) {
      lastInput = now;
    },
    click(now) {
      lastInput = now;
      recentClicks.push(now);
      while (recentClicks.length > HIDDEN_RULES.fastYawnClicks) recentClicks.shift();
      const first = recentClicks[0];
      if (
        first !== undefined &&
        recentClicks.length >= HIDDEN_RULES.fastYawnClicks &&
        now - first <= HIDDEN_RULES.fastYawnWindowMs
      ) {
        pending.push('fast_yawner');
      }
    },
    away(ms) {
      if (ms >= HIDDEN_RULES.longSleepMs) pending.push('long_sleep');
    },
    prestiged(now) {
      prestigedAt = now;
      lastInput = now;
    },
    poll(now, visible, hour) {
      const out = pending;
      pending = [];
      if (visible && now - lastInput >= HIDDEN_RULES.idleNapMs) out.push('idle_nap');
      const [from, to] = HIDDEN_RULES.nightOwlHours;
      if (hour >= from && hour < to) out.push('night_owl');
      if (prestigedAt !== null && lastInput <= prestigedAt && now - prestigedAt >= HIDDEN_RULES.nidoneMs) {
        out.push('nidone');
        prestigedAt = null;
      }
      return out;
    },
  };
}
