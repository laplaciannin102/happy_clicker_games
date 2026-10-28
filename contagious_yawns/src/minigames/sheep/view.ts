import { SHEEP_GAME, type RareSheepId } from '../../data/minigames';
import { ja, t } from '../../i18n/ja';
import { el, replayAnimation, setText } from '../../ui/dom';
import type { SheepSession } from './index';
import { isCountable, matchPress, type Sheep } from './logic';
import { iconSpan } from '../../ui/icons';

/** 柵の位置（レーンの左からの割合）と、羊が跳ぶ高さ・時間 */
const FENCE_X = 0.6;
const JUMP_PX = 46;
const JUMP_MS = 320;

/** めずらしい羊の目印（色だけに頼らないよう、絵文字をつける） */
const RARE_BADGE: Record<RareSheepId, string> = { gold: '✨', cloud: '☁️', star: '⭐', pajama: '💤', moon: '🌙' };

function sheepTravel(sh: Sheep): number {
  return sh.kind === 'slow' ? SHEEP_GAME.travelMs * SHEEP_GAME.slowFactor : SHEEP_GAME.travelMs;
}

/** 経過時間 elapsed のときの羊の位置（レーンに対する x の割合、跳ぶ高さ px）。画面外なら null */
function sheepPosition(sh: Sheep, elapsed: number): { x: number; y: number } | null {
  const travel = sheepTravel(sh);
  const progress = (elapsed - (sh.atMs - travel)) / travel; // 0＝左端、1＝柵
  if (progress < 0) return null;
  if (sh.kind === 'feint' && progress > 0.85) {
    // 跳ぶふり：柵の手前で引き返す
    const back = 0.85 - (progress - 0.85) * 1.5;
    return back < -0.1 ? null : { x: (back * FENCE_X) - 0.05, y: 0 };
  }
  const x = progress * FENCE_X - 0.05;
  if (x > 1.05) return null;
  const d = Math.abs(elapsed - sh.atMs);
  const y = d < JUMP_MS ? JUMP_PX * (1 - (d / JUMP_MS) ** 2) : 0;
  return { x, y };
}

function sheepNode(sh: Sheep): HTMLElement {
  const node = el('span', `sheep sheep-${sh.kind}`);
  node.append(iconSpan('sheep-body', 'sheep', sh.kind, '🐑'));
  if (sh.kind === 'black') node.append(el('span', 'sheep-badge', '⬛'));
  if (sh.rare) {
    node.classList.add(`sheep-rare-${sh.rare}`);
    node.append(el('span', 'sheep-badge', RARE_BADGE[sh.rare]));
  }
  return node;
}

/**
 * 羊を数える画面（全画面のダイアログ）。押した時刻（開始からの経過ミリ秒）を返す。
 * 途中で閉じたら、そこまでの押下で終わる。結果の判定は sheepGame.onFinish がもう一度行う。
 * onPress は押すたびに呼ぶ（効果音用。hit は数えてよい羊だったか）。
 */
export function playSheep(session: SheepSession, onPress?: (hit: boolean) => void): Promise<number[]> {
  const dialog = el('dialog', 'dialog sheep-dialog');
  dialog.setAttribute('aria-label', ja.sheep.label);
  const header = el('div', 'sheep-header');
  const time = el('span', 'sheep-time');
  const tally = el('span', 'sheep-tally');
  header.append(time, tally);

  const lane = el('div', 'sheep-lane');
  lane.setAttribute('aria-hidden', 'true');
  const fence = iconSpan('sheep-fence', 'sheep', 'fence', '🚧');
  fence.style.left = `${FENCE_X * 100}%`;
  const feedback = el('span', 'sheep-feedback');
  lane.append(fence, feedback);

  const button = el('button', 'button button-primary sheep-count', ja.sheep.count);
  button.type = 'button';
  const hint = el('p', 'sheep-hint', ja.sheep.countHint);
  dialog.append(header, lane, button, hint);
  document.body.append(dialog);

  const presses: number[] = [];
  const used = new Set<number>();
  const nodes = new Map<number, HTMLElement>();
  let counted = 0;
  let mistakes = 0;
  const start = performance.now();
  let frame = 0;

  const press = (): void => {
    const at = performance.now() - start;
    if (at > SHEEP_GAME.durationMs) return;
    presses.push(at);
    const i = matchPress(session.sheep, used, at);
    const hit = session.sheep[i];
    const ok = hit !== undefined && isCountable(hit);
    onPress?.(ok);
    if (ok) {
      counted += 1;
      setText(feedback, t(ja.sheep.hit, { n: counted }));
      feedback.classList.remove('is-miss');
    } else {
      mistakes += 1;
      setText(feedback, ja.sheep.miss);
      feedback.classList.add('is-miss');
    }
    replayAnimation(feedback, 'pop');
  };

  // キーボードで押したときのクリック（detail が 0）は keydown 側で数えるので、二重に数えない
  button.addEventListener('click', (e) => {
    if (e.detail !== 0) press();
  });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!e.repeat) press();
    }
  });

  return new Promise((resolve) => {
    const finish = (): void => {
      cancelAnimationFrame(frame);
      if (dialog.open) dialog.close();
    };
    dialog.addEventListener('close', () => {
      cancelAnimationFrame(frame);
      dialog.remove();
      resolve(presses);
    });

    const draw = (now: number): void => {
      const elapsed = now - start;
      setText(time, t(ja.sheep.timeLeft, { s: Math.max(0, Math.ceil((SHEEP_GAME.durationMs - elapsed) / 1000)) }));
      setText(tally, t(ja.sheep.tally, { c: counted, m: mistakes }));
      session.sheep.forEach((sh, i) => {
        const pos = sheepPosition(sh, elapsed);
        let node = nodes.get(i);
        if (!pos) {
          node?.remove();
          if (node) nodes.delete(i);
          return;
        }
        if (!node) {
          node = sheepNode(sh);
          nodes.set(i, node);
          lane.append(node);
        }
        node.style.left = `${(pos.x * 100).toFixed(2)}%`;
        node.style.transform = `translateY(${(-pos.y).toFixed(1)}px)`;
        node.classList.toggle('is-back', sh.kind === 'feint' && elapsed > sh.atMs - sheepTravel(sh) * 0.15);
      });
      if (elapsed >= SHEEP_GAME.durationMs) finish();
      else frame = requestAnimationFrame(draw);
    };

    dialog.showModal();
    button.focus();
    frame = requestAnimationFrame(draw);
  });
}
