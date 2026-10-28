import Decimal from 'break_eternity.js';
import { DREAM_NODES, DREAM_NODE_BY_ID, ENCORE, PRESTIGE, type DreamBranch, type DreamNodeDef } from '../data/prestige';
import { ja, t } from '../i18n/ja';
import type { GameState } from '../state/gameState';
import { encoreAvailable, encoreCost, encoreMultiplier, nodeStatus, shardBonus } from '../systems/dreamTree';
import { prestigeProgress, shardsForRun } from '../systems/prestige';
import { hasAutoPrestige } from '../systems/hibernation';
import { AUTO_PRESTIGE_RATIOS } from '../state/gameState';
import { el, setAttr, setHidden, setText } from './dom';
import { dreamNodeDesc, dreamNodeName } from './dreamText';
import { formatNumber } from './format';
import { iconSpan } from './icons';

export interface DreamPageHandlers {
  onPrestige(): void;
  onBuyNode(id: string): void;
  onBuyEncore(): void;
  onToggleAuto(): void;
  onAutoRatio(ratio: number): void;
}

export interface DreamPage {
  readonly root: HTMLElement;
  render(state: GameState): void;
}

const COLUMNS: readonly DreamBranch[] = ['madoromi', 'negoto', 'yumemi'];

function nodeCard(state: GameState, def: DreamNodeDef, onBuy: (id: string) => void): HTMLElement {
  const status = nodeStatus(state, def);
  const affordable = status === 'available' && state.prestige.shards >= def.cost;
  const button = el('button', `dream-node is-${status}${affordable ? ' is-affordable' : ''}`);
  button.type = 'button';
  setAttr(button, 'aria-disabled', String(!affordable));
  button.addEventListener('click', () => onBuy(def.id));

  const icon = iconSpan('dream-node-icon', 'dream', def.id, def.icon);
  const text = el('span', 'dream-node-text');
  text.append(
    el('span', 'dream-node-name', dreamNodeName(def)),
    el('span', 'dream-node-desc', dreamNodeDesc(def, state.settings.notation)),
  );
  let footer: string;
  if (status === 'owned') footer = ja.dream.nodeOwned;
  else if (status === 'locked') {
    const missing = def.requires.filter((r) => !state.prestige.nodes.has(r));
    const names = missing.map((id) => {
      const d = DREAM_NODE_BY_ID.get(id);
      return d ? dreamNodeName(d) : id;
    });
    footer = `${t(ja.dream.nodeCost, { n: def.cost })} ・ ${t(ja.dream.nodeNeeds, { list: names.join('・') })}`;
  } else footer = t(ja.dream.nodeCost, { n: def.cost });
  text.append(el('span', 'dream-node-cost', footer));
  button.append(icon, text);
  return button;
}

/** 夢の続き（DESIGN.md §6.4）：夢の交差点のあとに出る、何度でも解放できるカード。 */
function encoreCard(state: GameState, onBuy: () => void): HTMLElement {
  const p = state.prestige;
  const open = encoreAvailable(state);
  const cost = encoreCost(p.encore);
  const affordable = open && p.shards >= cost;
  const button = el('button', `dream-node dream-encore is-available${affordable ? ' is-affordable' : ''}`);
  button.type = 'button';
  setAttr(button, 'aria-disabled', String(!affordable));
  button.addEventListener('click', onBuy);
  const text = el('span', 'dream-node-text');
  text.append(
    el('span', 'dream-node-name', ja.encore.name),
    el('span', 'dream-node-desc', t(ja.encore.desc, { f: ENCORE.factor })),
    el('span', 'dream-node-desc', t(ja.encore.level, { n: p.encore, m: formatNumber(new Decimal(encoreMultiplier(state)), state.settings.notation) })),
    el('span', 'dream-node-cost', open ? t(ja.encore.cost, { n: cost.toLocaleString('ja-JP') }) : ja.encore.max),
  );
  button.append(iconSpan('dream-node-icon', 'dream', 'encore', ENCORE.icon), text);
  return button;
}

/** 夢（おやすみ・夢ツリー）のページ。 */
export function createDreamPage(handlers: DreamPageHandlers): DreamPage {
  const root = el('section', 'panel page-panel dream-page');
  root.append(el('h2', '', ja.dream.heading));

  const summary = el('p', 'page-summary');
  const hint = el('p', 'dream-hint', ja.dream.prestigeHint);
  const progress = el('div', 'dream-progress');
  const bar = el('div', 'dream-progress-bar');
  progress.append(bar);
  const button = el('button', 'button button-primary dream-prestige');
  button.type = 'button';
  button.addEventListener('click', handlers.onPrestige);

  // オートおやすみ（ぬくもりショップで解放）
  const auto = el('div', 'auto-prestige');
  auto.hidden = true;
  const autoToggle = el('button', 'auto-toggle');
  autoToggle.type = 'button';
  autoToggle.addEventListener('click', handlers.onToggleAuto);
  const autoSelect = el('select');
  autoSelect.setAttribute('aria-label', ja.autoPrestige.label);
  for (const r of AUTO_PRESTIGE_RATIOS) {
    const o = el('option', '', t(ja.autoPrestige.ratio, { p: r * 100 }));
    o.value = String(r);
    autoSelect.append(o);
  }
  autoSelect.addEventListener('change', () => handlers.onAutoRatio(Number(autoSelect.value)));
  const autoHelp = el('span', 'auto-prestige-help');
  auto.append(autoToggle, autoSelect, autoHelp);

  const tree = el('div', 'dream-tree');
  root.append(summary, hint, progress, button, auto, el('h3', '', ja.dream.treeHeading), tree);

  let treeKey = '';

  return {
    root,
    render(state) {
      const p = state.prestige;
      const notation = state.settings.notation;
      setText(
        summary,
        t(ja.dream.shardsSummary, {
          n: p.shards.toLocaleString('ja-JP'),
          total: p.shardsLifetime.toLocaleString('ja-JP'),
          p: formatNumber(new Decimal(shardBonus(state) * 100), notation, true),
        }),
      );

      const gain = shardsForRun(state);
      const ratio = prestigeProgress(state);
      bar.style.width = `${(ratio * 100).toFixed(1)}%`;
      setText(
        button,
        gain > 0
          ? t(ja.dream.prestigeButton, { n: gain.toLocaleString('ja-JP') })
          : t(ja.dream.prestigeLocked, {
              p: Math.floor(ratio * 100),
              now: formatNumber(state.totalYawns, notation),
              need: formatNumber(new Decimal(PRESTIGE.minTotal), notation),
            }),
      );
      setAttr(button, 'aria-disabled', String(gain <= 0));

      const ap = state.settings.autoPrestige;
      setHidden(auto, !hasAutoPrestige(state));
      setText(autoToggle, `${ja.autoPrestige.label}：${ap.enabled ? ja.dream.on : ja.dream.off}`);
      setAttr(autoToggle, 'aria-pressed', String(ap.enabled));
      if (autoSelect.value !== String(ap.ratio) && document.activeElement !== autoSelect) autoSelect.value = String(ap.ratio);
      setText(autoHelp, t(ja.autoPrestige.help, { p: ap.ratio * 100 }));

      // ツリーは「解放済み・手持ちのかけら・表記」が変わったときだけ作り直す
      const key = `${[...p.nodes].sort().join(',')}|${p.shards}|${p.encore}|${notation}`;
      if (key === treeKey) return;
      treeKey = key;
      // 上に入口、まん中に3本の枝、下に交差点
      const center = (branch: DreamBranch): HTMLElement => {
        const box = el('div', 'dream-center');
        for (const n of DREAM_NODES.filter((d) => d.branch === branch)) {
          box.append(nodeCard(state, n, handlers.onBuyNode));
        }
        return box;
      };
      const grid = el('div', 'dream-branches');
      for (const branch of COLUMNS) {
        const col = el('div', 'dream-branch');
        col.append(el('h4', '', ja.dream.branches[branch]));
        const nodes = DREAM_NODES.filter((n) => n.branch === branch).sort((a, b) => a.row - b.row || a.cost - b.cost);
        for (const n of nodes) col.append(nodeCard(state, n, handlers.onBuyNode));
        grid.append(col);
      }
      const last = center('cross');
      if (p.nodes.has(ENCORE.requires)) last.append(encoreCard(state, handlers.onBuyEncore));
      tree.replaceChildren(center('root'), grid, last);
    },
  };
}
