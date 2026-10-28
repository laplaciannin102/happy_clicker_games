import Decimal from 'break_eternity.js';
import { ENDING } from '../data/ending';
import { ja, t } from '../i18n/ja';
import type { GameState } from '../state/gameState';
import { canAwaken, endingProgress, endingVisible } from '../systems/ending';
import { el, setAttr, setHidden, setText } from './dom';
import { formatNumber } from './format';
import { imageUrl } from './icons';

export interface EndingSection {
  readonly root: HTMLElement;
  render(state: GameState): void;
}

/** めざめ（DESIGN.md §6.3）：冬眠のページの下に、条件の一覧とボタンを出す。 */
export function createEndingSection(onAwaken: () => void): EndingSection {
  const root = el('div', 'ending-section');
  root.hidden = true;
  const list = el('ul', 'ending-requirements');
  const button = el('button', 'button button-primary ending-button');
  button.type = 'button';
  button.addEventListener('click', onAwaken);
  const done = el('p', 'ending-done');
  root.append(el('h3', '', `🌅 ${ja.ending.heading}`), el('p', 'page-summary', ja.ending.intro), list, button, done);

  const items = endingProgressItems(list);

  return {
    root,
    render(state) {
      setHidden(root, !endingVisible(state));
      if (root.hidden) return;
      const notation = state.settings.notation;
      for (const r of endingProgress(state)) {
        const li = items[r.id];
        const now = r.id === 'goal' ? formatNumber(state.totalYawns, notation) : String(r.now);
        const need = r.id === 'goal' ? formatNumber(new Decimal(r.need), notation) : String(r.need);
        setText(li, `${r.met ? '✅' : '⬜'} ${t(ja.ending.requirements[r.id], { now, need })}`);
        li.classList.toggle('is-met', r.met);
      }
      const awakened = state.awakenedAt !== null;
      const ready = canAwaken(state);
      setText(button, awakened ? ja.ending.replay : ready ? ja.ending.button : ja.ending.locked);
      setAttr(button, 'aria-disabled', String(!awakened && !ready));
      setHidden(done, !awakened);
      if (state.awakenedAt !== null) {
        setText(done, t(ja.ending.done, { d: new Date(state.awakenedAt).toLocaleDateString('ja-JP'), f: ENDING.productionFactor }));
      }
    },
  };
}

function endingProgressItems(list: HTMLElement): Record<'challenges' | 'hibernations' | 'goal', HTMLElement> {
  const make = (): HTMLElement => {
    const li = el('li');
    list.append(li);
    return li;
  };
  return { challenges: make(), hibernations: make(), goal: make() };
}

/** エンディング：物語を1行ずつ見せる（演出 OFF なら最初から全部）。閉じたら解決する。 */
export function playEnding(effects: boolean): Promise<void> {
  const dialog = el('dialog', 'dialog ending-dialog');
  if (effects) dialog.classList.add('is-animated');
  const form = el('form');
  form.method = 'dialog';
  const body = el('div', 'dialog-body ending-story');
  const art = imageUrl('main', 'dawn');
  if (art) {
    const img = el('img', 'ending-art');
    img.src = art;
    img.alt = '';
    body.append(img);
  } else body.append(el('p', 'ending-sun', '🌅'));
  ja.ending.story.forEach((line, i) => {
    const p = el('p', 'ending-line', line);
    p.style.setProperty('--i', String(i));
    body.append(p);
  });
  const actions = el('div', 'dialog-actions');
  const ok = el('button', 'button button-primary', ja.ending.storyOk);
  ok.value = 'ok';
  actions.append(ok);
  form.append(el('h2', 'dialog-title', ja.ending.storyTitle), body, actions);
  dialog.append(form);
  document.body.append(dialog);
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve();
    });
    dialog.showModal();
    ok.focus();
  });
}
