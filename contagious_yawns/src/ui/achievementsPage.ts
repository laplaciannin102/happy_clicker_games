import { ACHIEVEMENTS, ACHIEVEMENT_BONUS } from '../data/achievements';
import { ja, t } from '../i18n/ja';
import type { GameState } from '../state/gameState';
import { achievementText } from './achievementText';
import { el, setText } from './dom';
import { iconSpan } from './icons';

export interface AchievementsPage {
  readonly root: HTMLElement;
  render(state: GameState): void;
}

/** 寝言日記（実績一覧）。解除数か表記が変わったときだけ作り直す。 */
export function createAchievementsPage(): AchievementsPage {
  const root = el('section', 'panel page-panel achievements-page');
  const heading = el('h2', '', ja.achievementsHeading);
  const summary = el('p', 'page-summary');
  const grid = el('ul', 'achievement-grid');
  root.append(heading, summary, grid);

  let key = '';

  return {
    root,
    render(state) {
      const count = state.achievements.size;
      setText(
        summary,
        t(ja.achievementsSummary, {
          n: count,
          total: ACHIEVEMENTS.length,
          p: Math.round(count * ACHIEVEMENT_BONUS * 100),
        }),
      );
      const nextKey = `${count}|${state.settings.notation}`;
      if (nextKey === key) return;
      key = nextKey;

      const items = ACHIEVEMENTS.map((def) => {
        const at = state.achievements.get(def.id);
        const unlocked = at !== undefined;
        const li = el('li', unlocked ? 'achievement is-unlocked' : 'achievement');
        const secret = def.hidden && !unlocked;
        const { name, desc } = secret
          ? { name: ja.achievementHiddenName, desc: ja.achievementHiddenDesc }
          : achievementText(def, state.settings.notation);
        const icon = unlocked
          ? iconSpan('achievement-icon', 'achievements', def.id, def.icon)
          : el('span', 'achievement-icon', '？');
        icon.setAttribute('aria-hidden', 'true');
        const text = el('span', 'achievement-text');
        text.append(el('span', 'achievement-name', name), el('span', 'achievement-desc', desc));
        li.append(icon, text);
        if (unlocked) li.title = t(ja.achievementUnlockedAt, { d: new Date(at).toLocaleString('ja-JP') });
        return li;
      });
      grid.replaceChildren(...items);
    },
  };
}
