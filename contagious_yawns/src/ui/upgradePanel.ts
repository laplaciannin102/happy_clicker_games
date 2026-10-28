import { UPGRADE_BY_ID, type UpgradeDef } from '../data/upgrades';
import { ja, t } from '../i18n/ja';
import type { GameState } from '../state/gameState';
import { hasAutoUpgrade } from '../systems/dreamTree';
import { conditionProgress, upgradeCost, visibleUpgrades } from '../systems/upgrades';
import { el, setAttr, setHidden, setText } from './dom';
import { formatNumber } from './format';
import { upgradeDesc, upgradeName } from './upgradeText';
import { setIcon, setIconText } from './icons';

export interface UpgradePanel {
  readonly root: HTMLElement;
  render(state: GameState): void;
}

interface Chip {
  def: UpgradeDef;
  button: HTMLButtonElement;
  icon: HTMLSpanElement;
  name: HTMLSpanElement;
  desc: HTMLSpanElement;
  cost: HTMLSpanElement;
}

function createChip(def: UpgradeDef, onBuy: (id: string) => void): Chip {
  const button = el('button', 'upgrade');
  button.type = 'button';
  const icon = el('span', 'upgrade-icon');
  icon.setAttribute('aria-hidden', 'true');
  const text = el('span', 'upgrade-text');
  const name = el('span', 'upgrade-name');
  const desc = el('span', 'upgrade-desc');
  const cost = el('span', 'upgrade-cost');
  text.append(name, desc, cost);
  button.append(icon, text);
  button.addEventListener('click', () => onBuy(def.id));
  return { def, button, icon, name, desc, cost };
}

/** まくら工房（アップグレード）。買えるものと「???」予告を安い順に並べる（SPEC §7 右列）。 */
export function createUpgradePanel(onBuy: (id: string) => void, onToggleAuto: () => void): UpgradePanel {
  const root = el('section', 'panel upgrade-panel');
  const header = el('div', 'panel-header');
  const heading = el('h2', '', ja.upgradesHeading);
  // 自動アップグレード（夢ツリーで解放）の ON/OFF
  const auto = el('button', 'auto-toggle');
  auto.type = 'button';
  auto.hidden = true;
  auto.addEventListener('click', onToggleAuto);
  header.append(heading, auto);
  const list = el('div', 'upgrade-list');
  const empty = el('p', 'upgrade-empty', ja.upgradesEmpty);
  root.append(header, list, empty);

  const chips = new Map<string, Chip>();
  let order = '';

  return {
    root,
    render(state) {
      const visible = visibleUpgrades(state);
      const key = visible.map((v) => v.def.id).join(',');
      if (key !== order) {
        order = key;
        for (const [id, chip] of chips) {
          if (!visible.some((v) => v.def.id === id)) {
            chip.button.remove();
            chips.delete(id);
          }
        }
        const nodes = visible.map(({ def }) => {
          let chip = chips.get(def.id);
          if (!chip) {
            chip = createChip(def, onBuy);
            chips.set(def.id, chip);
          }
          return chip.button;
        });
        list.replaceChildren(...nodes);
      }
      // 最初は出さない。1つでも見えたら、それ以降は空でもパネルを残す
      setHidden(root, visible.length === 0 && state.upgrades.size === 0);
      setHidden(empty, visible.length > 0);
      setHidden(auto, !hasAutoUpgrade(state));
      setText(auto, `${ja.dream.autoUpgrade}：${state.settings.autoUpgrade ? ja.dream.on : ja.dream.off}`);
      setAttr(auto, 'aria-pressed', String(state.settings.autoUpgrade));

      const notation = state.settings.notation;
      for (const { def, status } of visible) {
        const chip = chips.get(def.id);
        if (!chip) continue;
        const teaser = status === 'teaser';
        chip.button.classList.toggle('is-teaser', teaser);
        if (teaser) {
          const p = Math.floor(conditionProgress(state, def.condition) * 100);
          setIconText(chip.icon, '？');
          setText(chip.name, ja.upgradeTeaser);
          setText(chip.desc, '');
          setText(chip.cost, t(ja.upgradeTeaserHint, { p }));
          setAttr(chip.button, 'title', ja.upgradeTeaser);
          setAttr(chip.button, 'aria-disabled', 'true');
          chip.button.classList.remove('is-affordable');
          continue;
        }
        const name = upgradeName(def);
        const price = upgradeCost(state, def);
        const canBuy = state.yawns.gte(price);
        setIcon(chip.icon, 'upgrades', def.id, def.icon);
        setText(chip.name, name);
        setText(chip.desc, upgradeDesc(def));
        setText(chip.cost, t(ja.upgradeCost, { n: formatNumber(price, notation) }));
        setAttr(chip.button, 'title', `${name}\n${upgradeDesc(def)}`);
        setAttr(chip.button, 'aria-disabled', String(!canBuy));
        chip.button.classList.toggle('is-affordable', canBuy);
      }
    },
  };
}

export function upgradeNameById(id: string): string {
  const def = UPGRADE_BY_ID.get(id);
  return def ? upgradeName(def) : id;
}
