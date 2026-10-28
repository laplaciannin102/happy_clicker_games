import { ja } from '../i18n/ja';
import { el, setAttr, setHidden } from './dom';

/**
 * 画面の切り替え（SPEC §7）。
 * 広い画面では「ねどこ」に生産者と工房を並べるので、'upgrades' タブはスマホだけで出す。
 * 'about'（制作者）は広い画面だけ。スマホの下部タブには入りきらないので、ページ下のクレジットから開く。
 */
export const TAB_IDS = ['producers', 'upgrades', 'dream', 'hibernate', 'challenges', 'sheep', 'achievements', 'stats', 'help', 'about'] as const;
export type TabId = (typeof TAB_IDS)[number];

export interface TabBar {
  readonly root: HTMLElement;
  render(visible: Readonly<Record<TabId, boolean>>, active: TabId): void;
}

/** 広い画面の名前と、スマホの下部タブ用の短い名前 */
function label(id: TabId): HTMLElement[] {
  const wide = id === 'producers' ? ja.tabs.main : ja.tabs[id];
  const narrow = ja.tabsShort[id];
  if (wide === narrow) return [el('span', '', wide)];
  return [el('span', 'wide-only', wide), el('span', 'narrow-only', narrow)];
}

export function createTabBar(onSelect: (id: TabId) => void): TabBar {
  const root = el('nav', 'tabbar');
  root.setAttribute('aria-label', ja.tabsLabel);
  const buttons = TAB_IDS.map((id) => {
    const b = el('button', id === 'upgrades' ? 'tab narrow-only' : id === 'about' ? 'tab wide-only' : 'tab');
    b.type = 'button';
    b.append(...label(id));
    b.addEventListener('click', () => onSelect(id));
    root.append(b);
    return { id, b };
  });

  return {
    root,
    render(visible, active) {
      let shown = 0;
      for (const { id, b } of buttons) {
        setHidden(b, !visible[id]);
        if (visible[id]) shown++;
        setAttr(b, 'aria-current', id === active ? 'page' : 'false');
      }
      // 「ねどこ」しかないうちはタブ自体を出さない（最初は最小限の UI）
      setHidden(root, shown <= 1);
    },
  };
}
