import { ja } from '../i18n/ja';
import { permanentUpgrades, prestigeBalance } from '../data/prestige';
import type { GameState } from '../state/game';
import { prestigeReward, nextPrestigeTarget } from '../systems/prestige';
import { prestigeMultiplier } from '../systems/economy';
import { formatNumber } from './format';
import { node, updateText } from './dom';

export function createPrestigePanel(state: GameState, ascend: () => void, purchase: (id: string) => void) {
  const panel = node('section', '', 'panel');
  const reward = node('p', '', 'currency'), requirement = node('p'), next = node('p', '', 'muted');
  const wallet = node('p'), total = node('p'), bonus = node('p'), count = node('p');
  const button = node('button', ja.prestigeButton, 'whisper'); button.type = 'button';
  button.addEventListener('click', ascend);
  panel.append(node('h2', ja.prestigeTab), node('p', ja.prestigeIntro), node('h3', ja.prestigePreview),
    reward, requirement, next, node('p', ja.prestigeReset), node('p', ja.prestigeKeep), button,
    wallet, total, bonus, count, node('h3', ja.permanentTitle));
  const rows = permanentUpgrades.map((upgrade, index) => {
    const row = node('article', '', 'research-row');
    const cost = node('p', '', 'price');
    const buy = node('button', ja.permanentBuy); buy.type = 'button';
    buy.setAttribute('aria-label', `${ja.permanentBuy}：${ja.permanentNames[index]}`);
    buy.addEventListener('click', () => purchase(upgrade.id));
    row.append(node('h3', ja.permanentNames[index]), node('p', ja.permanentDescriptions[index]), cost, buy); panel.append(row);
    return { cost, buy };
  });
  panel.append(node('p', ja.chainPreview, 'muted'));
  function render() {
    const fmt = (value: Parameters<typeof formatNumber>[0]) => formatNumber(value, state.format);
    const gain = prestigeReward(state);
    updateText(reward, ja.prestigePoints(fmt(gain)));
    updateText(requirement, ja.prestigeRequirement(fmt(prestigeBalance.requirement)));
    updateText(next, ja.prestigeNext(fmt(nextPrestigeTarget(state))));
    updateText(wallet, ja.prestigeWallet(fmt(state.prestige.points)));
    updateText(total, ja.prestigeTotal(fmt(state.prestige.total)));
    updateText(bonus, ja.prestigeBonus(fmt(prestigeMultiplier(state))));
    updateText(count, ja.prestigeCount(String(state.prestige.count)));
    const disabled = gain.lt(1) || !!state.challenge.active;
    if (button.disabled !== disabled) button.disabled = disabled;
    permanentUpgrades.forEach((upgrade, index) => {
      const owned = state.prestige.upgrades.includes(upgrade.id);
      updateText(rows[index].cost, ja.permanentCost(fmt(upgrade.cost)));
      updateText(rows[index].buy, owned ? ja.researchOwned : ja.permanentBuy);
      const cannotBuy = owned || state.prestige.points.lt(upgrade.cost);
      if (rows[index].buy.disabled !== cannotBuy) rows[index].buy.disabled = cannotBuy;
    });
  }
  return { panel, render };
}
