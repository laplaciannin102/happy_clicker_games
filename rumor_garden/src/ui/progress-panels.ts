import Decimal from 'break_eternity.js';
import { ja } from '../i18n/ja';
import { balance, producers } from '../data/balance';
import { upgrades } from '../data/upgrades';
import { achievements } from '../data/achievements';
import type { GameState } from '../state/game';
import { production, producerRate, unlocked } from '../systems/economy';
import { upgradeUnlocked } from '../systems/upgrades';
import { achievementName, upgradeName } from './names';
import { formatNumber } from './format';
import { node, setHidden, updateText } from './dom';

export function createProgressPanels(state: GameState, purchase: (id: string) => void) {
  const research = node('section', '', 'panel research');
  research.append(node('h2', ja.upgradeTab), node('p', ja.researchIntro, 'muted'));
  const hint = node('p', ja.researchHint, 'muted'); research.append(hint);
  const researchRows = upgrades.map(upgrade => {
    const row = node('article', '', 'research-row');
    const effect = node('p', upgrade.producer === null ? ja.clickResearchEffect(upgrade.clickAdd.toString())
      : ja.producerResearchTarget(ja.producerNames[upgrade.producer],upgrade.multiplier.toString()), 'small research-effect');
    const requirement = node('p', '', 'small muted research-condition');
    const price = node('p', '', 'price small');
    const button = node('button', ja.researchBuy);
    button.type = 'button'; button.setAttribute('aria-label', `${ja.researchBuy}：${upgradeName(upgrade)}`);
    button.addEventListener('click', () => purchase(upgrade.id));
    row.append(node('h3', upgradeName(upgrade)), effect, requirement, price, button); research.append(row);
    return { row, effect, requirement, price, button };
  });
  const achievementPanel = node('section', '', 'panel');
  const achievementSummary = node('p');
  const list = node('ul', '', 'achievement-list');
  const achievementRows = achievements.map(() => {
    const row = node('li'); const name = node('strong'); const status = node('p', '', 'small muted');
    row.append(name, status); list.append(row); return { row, name, status };
  });
  achievementPanel.append(node('h2', ja.achievementTab), achievementSummary, list);
  const statistics = node('section', '', 'panel');
  const stats = node('dl', '', 'stats');
  const labels = [ja.statsBalance, ja.statsEarned, ja.statsLifetime, ja.statsRunTime, ja.statsRunClicks,
    ja.statsPrestige, ja.statsBestRun, ja.statsProduction, ja.statsResearch, ja.statsEvents,
    ja.statsOfflineTime, ja.statsOfflineEarned, ja.statsLastOffline, ja.statsRecord];
  const values = labels.map(label => { const value = node('dd'); stats.append(node('dt', label), value); return value; });
  const totalClicks = node('p'), playTime = node('p'), generated = node('p');
  const breakdown = node('ul', '', 'breakdown');
  const rates = producers.map(() => { const row = node('li'); breakdown.append(row); return row; });
  statistics.append(node('h2', ja.statistics), totalClicks, playTime, generated, stats, node('h3', ja.producerBreakdown), breakdown);

  function render() {
    const fmt = (amount: Decimal) => formatNumber(amount, state.format);
    setHidden(hint, state.earned.gte(balance.researchUnlock));
    upgrades.forEach((upgrade, index) => {
      const row = researchRows[index], owned = state.upgrades.includes(upgrade.id);
      row.row.classList.toggle('purchased', owned);
      const available = upgradeUnlocked(state, upgrade);
      const next = upgrades.find(item => item.producer === upgrade.producer && !state.upgrades.includes(item.id));
      const preview = next === upgrade && upgrade.producer !== null && state.owned[upgrade.producer] > 0;
      setHidden(row.row, !owned && !available && !preview);
      updateText(row.requirement, available || owned ? '' : upgrade.producer === null
        ? ja.clickResearchRequirement(fmt(upgrade.requirement))
        : ja.researchRequiredCount(fmt(upgrade.requirement)));
      const details = [upgradeName(upgrade), row.effect.textContent, row.requirement.textContent].filter(Boolean).join(' / ');
      if (row.row.title !== details) row.row.title = details;
      updateText(row.price, `${ja.price} ${fmt(upgrade.cost)}`);
      const disabled = owned || !available || state.currency.lt(upgrade.cost);
      if (row.button.disabled !== disabled) row.button.disabled = disabled;
      updateText(row.button, owned ? ja.researchOwned : ja.researchBuy);
    });
    updateText(achievementSummary, ja.achievementSummary(state.achievements.length, achievements.length,
      balance.achievementBonus.mul(new Decimal(state.achievements.length)).mul(100).toFixed(1)));
    achievements.forEach((achievement, index) => {
      const row = achievementRows[index], done = state.achievements.includes(achievement.id);
      const concealed = !done && (achievement.hidden ||
        (achievement.kind === 'owned' && !unlocked(state, achievement.producer)));
      updateText(row.name, concealed ? ja.unknown : achievementName(achievement));
      updateText(row.status, concealed ? ja.hiddenAchievementHint : done ? ja.achieved : ja.notAchieved);
      const className = done ? 'achievement done' : 'achievement';
      if (row.row.className !== className) row.row.className = className;
    });
    const total = production(state);
    const texts = [fmt(state.currency), fmt(state.earned), fmt(state.lifetimeEarned), String(Math.floor(state.runSeconds)),
      String(state.runClicks), String(state.prestige.count), fmt(state.records.bestRunEarned),
      fmt(total), `${state.upgrades.length} / ${upgrades.length}`,
      String(state.events.collected), String(Math.floor(state.offlineSeconds)), fmt(state.offlineEarned),
      ja.offlineReport(String(Math.ceil(state.lastOffline.seconds)), fmt(state.lastOffline.gained), state.lastOffline.capped),
      state.tainted ? ja.tainted : ja.clean];
    texts.forEach((text, index) => updateText(values[index], text));
    updateText(totalClicks, ja.clicksLabel(String(state.clicks)));
    updateText(playTime, ja.timeLabel(String(Math.floor(state.playSeconds))));
    updateText(generated, ja.offlineGenerated(fmt(state.lastOfflineGenerated.reduce((sum, value) => sum.add(value), new Decimal(0)))));
    rates.forEach((row, index) => {
      setHidden(row, !unlocked(state, index));
      const output = producerRate(state, index);
      const portion = total.gt(0) ? output.div(total).mul(100).toFixed(1) : '0';
      updateText(row, `${ja.producerNames[index]} / ${ja.generatedLabel(String(state.owned[index]), fmt(state.generated[index]))} / ${ja.rateLabel(fmt(output))} / ${portion}%`);
    });
  }
  return { research, achievementPanel, statistics, render };
}
