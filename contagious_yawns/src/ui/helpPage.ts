import Decimal from 'break_eternity.js';
import { OFFLINE } from '../data/economy';
import { LOTTERY } from '../data/lottery';
import { PRESTIGE } from '../data/prestige';
import { STARS } from '../data/stars';
import { ja, t } from '../i18n/ja';
import { lotteryUnlocked } from '../minigames/lottery';
import type { GameState } from '../state/gameState';
import { challengesUnlocked } from '../systems/challenges';
import { endingVisible } from '../systems/ending';
import { hibernationUnlocked } from '../systems/hibernation';
import { sheepUnlocked } from '../systems/pillows';
import { dreamUnlocked } from '../systems/prestige';
import { visibleUpgrades } from '../systems/upgrades';
import { el, setHidden, setText } from './dom';
import { formatNumber } from './format';

export interface HelpPage {
  readonly root: HTMLElement;
  render(state: GameState): void;
}

type SectionId = keyof typeof ja.help.sections;

/** 節ごとの「見せるか」。まだ出会っていない仕組みはネタばらししない（「？？？」の数だけ出す）。 */
const SHOWN: Readonly<Record<SectionId, (s: GameState) => boolean>> = {
  basic: () => true,
  upgrades: (s) => s.upgrades.size > 0 || visibleUpgrades(s).length > 0 || s.prestige.count > 0,
  stars: (s) => s.lifetime.stars > 0 || s.stars.active !== null || s.prestige.count > 0,
  offline: () => true,
  records: (s) => s.achievements.size > 0,
  dream: dreamUnlocked,
  sheep: sheepUnlocked,
  lottery: lotteryUnlocked,
  hibernate: hibernationUnlocked,
  challenges: challengesUnlocked,
  ending: endingVisible,
  settings: () => true,
};

/** 文中の {n} などに入れる値（数値は data から取り、文に直書きしない）。 */
export function helpParams(state: GameState): Record<string, string | number> {
  return {
    n: formatNumber(new Decimal(PRESTIGE.minTotal), state.settings.notation),
    min: STARS.minIntervalMs / 60_000,
    max: STARS.maxIntervalMs / 60_000,
    s: STARS.visibleMs / 1000,
    h: OFFLINE.capMs / 3_600_000,
    p: Math.round(OFFLINE.efficiency * 100),
    tickets: LOTTERY.ticketsMax,
  };
}

/** 遊び方（ヘルプ）。最初から見られるタブ。解放した仕組みの説明だけを出す。 */
export function createHelpPage(): HelpPage {
  const root = el('section', 'panel page-panel help-page');
  root.append(el('h2', '', ja.help.heading), el('p', 'page-summary', ja.help.intro));

  const sections = (Object.keys(ja.help.sections) as SectionId[]).map((id) => {
    const def = ja.help.sections[id];
    const box = el('section', 'help-section');
    const list = el('ul', 'help-lines');
    box.append(el('h3', '', def.title), list);
    root.append(box);
    return { id, box, list, lines: def.lines as readonly string[] };
  });
  const locked = el('p', 'help-locked');
  root.append(locked);

  // 解放の状況と表記が変わったときだけ作り直す
  let key = '';

  return {
    root,
    render(state) {
      const shown = sections.map((s) => SHOWN[s.id](state));
      const nextKey = `${shown.join(',')}|${state.settings.notation}`;
      if (nextKey === key) return;
      key = nextKey;
      const values = helpParams(state);
      sections.forEach((s, i) => {
        setHidden(s.box, !shown[i]);
        s.list.replaceChildren(...s.lines.map((line) => el('li', '', t(line, values))));
      });
      const hidden = shown.filter((v) => !v).length;
      setText(locked, t(ja.help.locked, { n: hidden }));
      setHidden(locked, hidden === 0);
    },
  };
}
