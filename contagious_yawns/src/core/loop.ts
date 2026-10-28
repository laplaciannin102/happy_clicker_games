import { TIMING } from '../data/economy';

export interface LoopHooks {
  /** 固定タイムステップの更新（秒） */
  update(dtSec: number): void;
  /** タブ復帰などで大きく時間があいたときの一括処理（秒） */
  catchUp(elapsedSec: number): void;
  /** 描画。requestAnimationFrame で間引いて呼ぶ */
  render(): void;
}

/** ゲームループを開始し、停止用の関数を返す（SPEC §3 鉄則3）。 */
export function startLoop(hooks: LoopHooks): () => void {
  const tickSec = TIMING.tickMs / 1000;
  let last = performance.now();
  let acc = 0;

  const step = (): void => {
    const now = performance.now();
    const elapsed = now - last;
    last = now;
    if (elapsed >= TIMING.catchUpThresholdMs) {
      hooks.catchUp(elapsed / 1000);
      acc = 0;
      return;
    }
    acc += elapsed;
    while (acc >= TIMING.tickMs) {
      hooks.update(tickSec);
      acc -= TIMING.tickMs;
    }
  };

  let lastRender = 0;
  let frame = 0;
  const draw = (now: number): void => {
    if (now - lastRender >= TIMING.renderMs) {
      lastRender = now;
      hooks.render();
    }
    frame = requestAnimationFrame(draw);
  };

  const onVisible = (): void => {
    if (document.visibilityState === 'visible') step();
  };

  const timer = window.setInterval(step, TIMING.tickMs);
  frame = requestAnimationFrame(draw);
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    window.clearInterval(timer);
    cancelAnimationFrame(frame);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
