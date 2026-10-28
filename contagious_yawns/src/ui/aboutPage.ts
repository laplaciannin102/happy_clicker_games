import { CREDITS } from '../data/credits';
import { ja, t } from '../i18n/ja';
import { el } from './dom';
import { iconSpan } from './icons';

export interface AboutPage {
  readonly root: HTMLElement;
}

/** 制作者のページ。中身は data/credits.ts と i18n で決まり、ゲームの状態には依存しない。 */
export function createAboutPage(onBack: () => void): AboutPage {
  const c = ja.credits;
  const root = el('section', 'panel page-panel about-page');
  const face = iconSpan('about-face', 'main', 'yawn', '🥱');
  root.append(el('h2', '', c.heading), face, el('p', 'page-summary', c.intro));

  const dl = el('dl', 'stats-list about-list');
  dl.append(el('dt', '', c.creatorLabel), el('dd', '', CREDITS.creator));
  if (CREDITS.links.length > 0) {
    const dd = el('dd', 'about-links');
    for (const link of CREDITS.links) {
      const a = el('a', '', link.label);
      a.href = link.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      dd.append(a);
    }
    dl.append(el('dt', '', c.linksLabel), dd);
  }
  root.append(dl, el('p', 'about-message', c.message));

  const thanks = el('ul', 'help-lines');
  for (const line of c.thanks) thanks.append(el('li', '', line));
  const back = el('button', 'button about-back', c.back);
  back.type = 'button';
  back.addEventListener('click', onBack);
  root.append(el('h3', '', c.thanksHeading), thanks, back, el('p', 'about-copy', t(c.footer, { year: CREDITS.year, name: CREDITS.creator })));
  return { root };
}

/** 全ページの下に出す小さなクレジット。「制作者について」で制作者のページを開く。 */
export function createFooter(onAbout: () => void): HTMLElement {
  const root = el('footer', 'site-footer');
  const link = el('button', 'footer-link', ja.credits.aboutLink);
  link.type = 'button';
  link.addEventListener('click', onAbout);
  root.append(el('span', '', t(ja.credits.footer, { year: CREDITS.year, name: CREDITS.creator })), el('span', 'footer-sep', '・'), link);
  return root;
}
