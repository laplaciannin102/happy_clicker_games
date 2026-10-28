import { ja } from '../i18n/ja';
import type { GameState } from '../state/gameState';
import { currentSeason } from '../systems/hibernation';
import { el, setHidden, setText } from './dom';
import { seasonLabel } from './hibernationPage';

export interface TopBarHandlers {
  onSave(): void;
  onSettings(): void;
}

export interface TopBar {
  readonly root: HTMLElement;
  render(state: GameState): void;
}

export function createTopBar(handlers: TopBarHandlers): TopBar {
  const root = el('header', 'topbar');
  const titleBox = el('div', 'title-box');
  const title = el('h1', 'title', ja.title);
  const tainted = el('span', 'tainted-badge', ja.taintedBadge);
  tainted.title = ja.taintedHelp;
  tainted.hidden = true;
  // 季節（冬眠のあと）。ルールは title で見せる
  const season = el('span', 'season-badge');
  season.hidden = true;
  titleBox.append(title, season, tainted);

  const controls = el('div', 'topbar-controls');
  const save = el('button', 'button', ja.save);
  save.type = 'button';
  save.addEventListener('click', handlers.onSave);
  const settings = el('button', 'button', `⚙ ${ja.settings}`);
  settings.type = 'button';
  settings.addEventListener('click', handlers.onSettings);
  controls.append(save, settings);

  root.append(titleBox, controls);

  return {
    root,
    render(state) {
      setHidden(tainted, !state.tainted);
      const now = currentSeason(state);
      setHidden(season, now === null);
      if (now) {
        setText(season, seasonLabel(now));
        if (season.title !== ja.hibernation.seasons[now].rule) season.title = ja.hibernation.seasons[now].rule;
      }
    },
  };
}
