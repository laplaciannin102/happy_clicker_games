import { PILLOWS, RARE_SHEEP, SHEEP_GAME } from '../data/minigames';
import { ja, t } from '../i18n/ja';
import { sheepGame, type SheepReward } from '../minigames/sheep';
import type { GameState } from '../state/gameState';
import { el, setAttr, setHidden, setText } from './dom';
import { formatDuration, formatNumber } from './format';
import { iconSpan } from './icons';

export interface SheepPage {
  readonly root: HTMLElement;
  render(state: GameState): void;
  showResult(reward: SheepReward): void;
}

/** ひつじ牧場：まくら・費用・開始ボタン・前回の結果・羊図鑑。 */
export function createSheepPage(onStart: () => void): SheepPage {
  const root = el('section', 'panel page-panel sheep-page');
  root.append(el('h2', '', ja.sheep.heading), el('p', 'page-summary', ja.sheep.intro));
  const rules = el('ul', 'sheep-rules');
  for (const r of ja.sheep.rules) rules.append(el('li', '', r));

  const pillows = el('p', 'sheep-pillows');
  const next = el('p', 'sheep-next');
  const cost = el('p', 'sheep-cost');
  const start = el('button', 'button button-primary sheep-start', ja.sheep.start);
  start.type = 'button';
  start.addEventListener('click', onStart);
  const reason = el('p', 'sheep-reason');
  const best = el('p', 'sheep-best');

  const result = el('div', 'sheep-result');
  result.hidden = true;

  const collection = el('ul', 'sheep-collection');
  root.append(rules, pillows, next, cost, start, reason, best, result, el('h3', '', ja.sheep.collectionHeading), collection);

  let collectionKey = '';

  return {
    root,
    render(state) {
      const m = state.minigames;
      const price = sheepGame.cost(state);
      setText(pillows, `🛏️ ${t(ja.sheep.pillows, { n: m.pillows, max: PILLOWS.max })}`);
      setText(
        next,
        m.pillows >= PILLOWS.max ? ja.sheep.pillowFull : t(ja.sheep.pillowNext, { t: formatDuration(m.pillowTimerMs / 1000) }),
      );
      setText(cost, t(ja.sheep.cost, { n: formatNumber(price.yawns, state.settings.notation) }));
      const why = m.pillows < price.pillows ? ja.sheep.cannotPillow : state.yawns.lt(price.yawns) ? ja.sheep.cannotYawns : '';
      setText(reason, why);
      setHidden(reason, why === '');
      setAttr(start, 'aria-disabled', String(why !== ''));
      setText(best, t(ja.sheep.best, { n: m.sheepBest, p: m.sheepPlays }));

      const key = [...m.collection].sort().join(',');
      if (key === collectionKey && collection.childElementCount > 0) return;
      collectionKey = key;
      collection.replaceChildren(
        ...RARE_SHEEP.map((id) => {
          const found = m.collection.has(id);
          const li = el('li', found ? 'sheep-card is-found' : 'sheep-card');
          li.append(
            found ? iconSpan('sheep-card-icon', 'sheep', id, '🐑') : el('span', 'sheep-card-icon', '？'),
            el('span', 'sheep-card-name', found ? ja.sheep.rareNames[id] : ja.sheep.unknown),
          );
          return li;
        }),
      );
    },
    showResult(reward) {
      const { result: r, points, factor, newRares, best: isBest } = reward;
      const lines = [t(ja.sheep.resultLine, { c: r.counted, m: r.mistakes, p: points })];
      lines.push(factor > 1 ? t(ja.sheep.resultReward, { s: SHEEP_GAME.buffMs / 1000, f: Math.round(factor * 10) / 10 }) : ja.sheep.resultNone);
      if (isBest) lines.push(ja.sheep.resultBest);
      if (newRares.length > 0) {
        lines.push(t(ja.sheep.resultNewRare, { list: newRares.map((id) => ja.sheep.rareNames[id]).join('・') }));
      }
      result.replaceChildren(el('h3', '', ja.sheep.resultTitle), ...lines.map((l) => el('p', '', l)));
      result.hidden = false;
    },
  };
}
