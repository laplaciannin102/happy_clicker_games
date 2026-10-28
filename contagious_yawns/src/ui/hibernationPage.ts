import { HIBERNATION, SEASONS, WARMTH_SHOP, type SeasonId, type WarmthItemDef } from '../data/hibernation';
import { DREAM_NODE_BY_ID } from '../data/prestige';
import { ja, t } from '../i18n/ja';
import type { GameState } from '../state/gameState';
import { canHibernate, currentSeason, nextSeason, shardsForNextWarmth, warmthForNow } from '../systems/hibernation';
import { el, setAttr, setText } from './dom';
import { dreamNodeName } from './dreamText';
import { createEndingSection } from './endingSection';
import { iconSpan } from './icons';

export interface HibernationPageHandlers {
  onHibernate(): void;
  onBuyItem(id: string): void;
  onAwaken(): void;
}

export interface HibernationPage {
  readonly root: HTMLElement;
  render(state: GameState): void;
}

/** 季節の名前とルールの説明。 */
export function seasonLabel(id: SeasonId): string {
  return `${SEASONS[id].icon} ${ja.hibernation.seasons[id].name}`;
}

export function warmthItemDesc(def: WarmthItemDef): string {
  const e = def.effect;
  switch (e.kind) {
    case 'keepNodes':
      return t(ja.hibernation.keepNodes, {
        list: e.nodes.map((id) => {
          const n = DREAM_NODE_BY_ID.get(id);
          return n ? dreamNodeName(n) : id;
        }).join('・'),
      });
    case 'production':
      return t(ja.hibernation.production, { f: e.factor });
    case 'shardGain':
      return t(ja.hibernation.shardGain, { f: e.factor });
    case 'autoPrestige':
      return ja.hibernation.autoPrestige;
    case 'fastAutomation':
      return t(ja.hibernation.fastAutomation, { f: e.factor });
  }
}

/** 冬眠（第2層）：ぬくもり・季節・冬眠ボタン・ぬくもりショップ。 */
export function createHibernationPage(handlers: HibernationPageHandlers): HibernationPage {
  const root = el('section', 'panel page-panel hibernation-page');
  root.append(el('h2', '', ja.hibernation.heading), el('p', 'page-summary', ja.hibernation.intro));

  const summary = el('p', 'hibernation-summary');
  const season = el('div', 'season-card');
  const next = el('p', 'hibernation-next');
  const rule = el('p', 'hibernation-next');
  const button = el('button', 'button button-primary hibernation-button');
  button.type = 'button';
  button.addEventListener('click', handlers.onHibernate);
  const shop = el('ul', 'warmth-shop');
  const ending = createEndingSection(handlers.onAwaken);
  root.append(summary, season, next, rule, button, ending.root, el('h3', '', ja.hibernation.shopHeading), shop);

  let shopKey = '';

  return {
    root,
    render(state) {
      const h = state.hibernation;
      setText(
        summary,
        t(ja.hibernation.summary, {
          n: h.warmth,
          total: h.warmthLifetime,
          p: Math.round(h.warmthLifetime * HIBERNATION.bonusPerWarmth * 100),
          c: h.count,
        }),
      );

      const now = currentSeason(state);
      const nowText = now ? `${seasonLabel(now)}：${ja.hibernation.seasons[now].rule}` : ja.hibernation.noSeason;
      setText(season, `${ja.hibernation.currentSeason} ${nowText}`);
      const upcoming = nextSeason(state);
      setText(next, t(ja.hibernation.nextSeason, { s: `${seasonLabel(upcoming)}（${ja.hibernation.seasons[upcoming].rule}）` }));

      setText(rule, t(ja.hibernation.rule, { need: shardsForNextWarmth(state).toLocaleString('ja-JP') }));
      const ready = canHibernate(state);
      setText(button, ready ? t(ja.hibernation.button, { n: warmthForNow(state) }) : ja.hibernation.locked);
      setAttr(button, 'aria-disabled', String(!ready));
      ending.render(state);

      const key = `${[...h.shop].sort().join(',')}|${h.warmth}`;
      if (key === shopKey) return;
      shopKey = key;
      shop.replaceChildren(
        ...WARMTH_SHOP.map((def) => {
          const owned = h.shop.has(def.id);
          const affordable = !owned && h.warmth >= def.cost;
          const item = el('li');
          const b = el('button', `warmth-item${owned ? ' is-owned' : ''}${affordable ? ' is-affordable' : ''}`);
          b.type = 'button';
          setAttr(b, 'aria-disabled', String(!affordable));
          b.addEventListener('click', () => handlers.onBuyItem(def.id));
          const icon = iconSpan('warmth-icon', 'warmth', def.id, def.icon);
          const text = el('span', 'warmth-text');
          text.append(
            el('span', 'warmth-name', ja.hibernation.items[def.id] ?? def.id),
            el('span', 'warmth-desc', warmthItemDesc(def)),
            el('span', 'warmth-cost', owned ? ja.hibernation.owned : t(ja.hibernation.cost, { n: def.cost })),
          );
          b.append(icon, text);
          item.append(b);
          return item;
        }),
      );
    },
  };
}
