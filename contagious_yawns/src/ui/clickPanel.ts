import type Decimal from 'break_eternity.js';
import { ja, t } from '../i18n/ja';
import type { GameState } from '../state/gameState';
import { totalRate } from '../systems/production';
import { el, replayAnimation, setHidden, setText } from './dom';
import { formatNumber } from './format';
import { challengeLine } from './challengesPage';
import { buffText } from './starText';
import { iconSpan } from './icons';
import { effectsEnabled } from './appearance';

/** 同時に浮かべる「+1」の上限 */
const MAX_FLOATERS = 16;
/** 「桁が増えた！」を続けて出さない間隔（終盤は単位がすぐ変わるので） */
const DIGIT_UP_GAP_MS = 4_000;
/** 桁が増えたときに散らす星の数 */
const SPARKLES = 8;

export interface ClickPanel {
  readonly root: HTMLElement;
  render(state: GameState): void;
  /** クリックで得た量を浮かび上がらせる */
  showGain(state: GameState, amount: Decimal): void;
}

export function createClickPanel(onClick: () => void, onDigitUp: () => void): ClickPanel {
  const root = el('section', 'panel click-panel');
  root.setAttribute('aria-label', ja.currency);

  const counter = el('div', 'counter');
  const value = el('span', 'counter-value', '0');
  const unit = el('span', 'counter-unit', ja.currency);
  counter.append(value, unit);
  counter.setAttribute('aria-live', 'off');

  const rate = el('p', 'rate');
  // 流れ星の効果が効いているあいだだけ出す
  const buffs = el('ul', 'buffs');
  buffs.setAttribute('aria-live', 'polite');

  const button = el('button', 'yawn-button');
  button.type = 'button';
  button.setAttribute('aria-label', ja.clickButton);
  const face = iconSpan('yawn-face', 'main', 'yawn', '🥱');
  button.append(face);
  button.addEventListener('click', onClick);

  const effects = el('div', 'effects');
  effects.setAttribute('aria-hidden', 'true');
  const stage = el('div', 'yawn-stage');
  stage.append(button, effects);

  const hint = el('p', 'hint', ja.clickHint);

  // 挑戦中のチャレンジ（あれば）
  const challenge = el('p', 'challenge-line');
  challenge.hidden = true;
  root.append(counter, rate, challenge, buffs, stage, hint);

  // 単位（万→億など）が増えた瞬間を演出する
  let lastUnit: string | null = null;
  let lastYawns: Decimal | null = null;
  let lastDigitUpAt = -Infinity;

  function digitUp(state: GameState): void {
    const now = performance.now();
    if (now - lastDigitUpAt < DIGIT_UP_GAP_MS) return;
    lastDigitUpAt = now;
    onDigitUp();
    if (!effectsEnabled(state.settings)) return;
    const label = el('span', 'digit-up', ja.digitUp);
    label.addEventListener('animationend', () => label.remove());
    effects.append(label);
    for (let i = 0; i < SPARKLES; i++) {
      const spark = el('span', 'sparkle', '✦');
      const angle = (i / SPARKLES) * Math.PI * 2;
      spark.style.setProperty('--dx', `${Math.round(Math.cos(angle) * 90)}px`);
      spark.style.setProperty('--dy', `${Math.round(Math.sin(angle) * 90)}px`);
      spark.addEventListener('animationend', () => spark.remove());
      effects.append(spark);
    }
  }

  return {
    root,
    render(state) {
      const text = formatNumber(state.yawns, state.settings.notation);
      setText(value, text);
      const unitPart = text.replace(/[\d.,-]/g, '');
      if (lastUnit !== null && unitPart !== lastUnit && lastYawns !== null && state.yawns.gt(lastYawns)) {
        replayAnimation(counter, 'bump');
        digitUp(state);
      }
      lastUnit = unitPart;
      lastYawns = state.yawns;
      setText(rate, t(ja.perSecond, { n: formatNumber(totalRate(state), state.settings.notation, true) }));

      const line = challengeLine(state);
      setHidden(challenge, line === null);
      if (line) setText(challenge, line);

      root.classList.toggle('is-boosted', state.buffs.length > 0);
      setHidden(buffs, state.buffs.length === 0);
      while (buffs.childElementCount > state.buffs.length) buffs.lastElementChild?.remove();
      state.buffs.forEach((b, i) => {
        const li = buffs.children[i] ?? buffs.appendChild(el('li'));
        if (li instanceof HTMLElement) setText(li, buffText(b));
      });
    },
    showGain(state, amount) {
      if (!effectsEnabled(state.settings)) return;
      replayAnimation(face, 'pop');
      if (effects.childElementCount >= MAX_FLOATERS) effects.firstElementChild?.remove();
      const floater = el('span', 'floater', `+${formatNumber(amount, state.settings.notation, true)}`);
      // 見た目だけの揺らぎなので、ゲーム用のシード付き乱数は使わない
      floater.style.setProperty('--dx', `${Math.round((Math.random() - 0.5) * 120)}px`);
      floater.addEventListener('animationend', () => floater.remove());
      effects.append(floater);
    },
  };
}
