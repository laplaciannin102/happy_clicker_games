import { ja } from '../i18n/ja';
import type { GameState } from '../state/gameState';
import { el, setHidden } from './dom';
import { iconSpan } from './icons';

export interface StarLayer {
  readonly root: HTMLElement;
  render(state: GameState): void;
}

/**
 * 流れ星（DESIGN.md §9）。位置は状態に保存された割合から決める。
 * キーボードでも拾えるよう、ふつうのボタンにする。
 */
export function createStarLayer(onCatch: () => void, onAppear: () => void): StarLayer {
  const root = el('div', 'star-layer');
  const star = el('button', 'star');
  star.append(iconSpan('star-icon', 'stars', 'star', '🌠'));
  star.type = 'button';
  star.setAttribute('aria-label', ja.star.label);
  star.hidden = true;
  star.addEventListener('click', onCatch);
  root.append(star);

  let shownKey = '';

  return {
    root,
    render(state) {
      const active = state.stars.active;
      setHidden(star, active === null);
      if (!active) {
        shownKey = '';
        return;
      }
      // 同じ星のあいだは位置を書き換えない（アニメーションを止めないため）
      const key = `${active.x}|${active.y}`;
      if (key === shownKey) return;
      if (shownKey === '') onAppear();
      shownKey = key;
      star.style.left = `${(active.x * 100).toFixed(2)}%`;
      star.style.top = `${(active.y * 100).toFixed(2)}%`;
    },
  };
}
