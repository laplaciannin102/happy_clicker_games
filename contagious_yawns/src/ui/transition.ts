import { el } from './dom';

/** 画面がゆっくり暗くなって、また明るくなるまで */
const TRANSITION_MS = 1_800;

/**
 * おやすみ・冬眠の場面転換。画面をいったん夜色で覆い、ひとこと出してから戻す。
 * 見た目だけで、ゲームの処理はこの前に済ませておく（演出 OFF なら呼ばない）。
 */
export function playTransition(text: string, icon: string): void {
  const veil = el('div', 'transition-veil');
  veil.setAttribute('aria-hidden', 'true');
  veil.style.setProperty('--transition-ms', `${TRANSITION_MS}ms`);
  veil.append(el('span', 'transition-icon', icon), el('span', 'transition-text', text));
  document.body.append(veil);
  veil.addEventListener('animationend', () => veil.remove());
  // animationend が来ない環境（タブが裏にあるなど）でも必ず消す
  window.setTimeout(() => veil.remove(), TRANSITION_MS + 500);
}
