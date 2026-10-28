import Decimal from 'break_eternity.js';
import { ja } from '../i18n/ja';
import { balance, producers } from '../data/balance';
import type { BuyMode, GameState, NumberFormat } from '../state/game';
import { clickGain, cost, producerRate, production, purchaseQuantity, unlocked, unitRate } from '../systems/economy';
import { chainActive } from '../systems/chain';
import { mythBalance } from '../data/myth';
import { formatNumber } from './format';
import { node, setHidden, updateText } from './dom';
import { createProgressPanels } from './progress-panels';
import { createPrestigePanel } from './prestige-panel';
import { prestigeBalance } from '../data/prestige';
import { createTalePanel, type TaleAction } from './tale-panel';
import { createMythPanel, type ProgressionActions } from './myth-panel';
import { artwork } from './assets';
import { createFeedback } from './feedback';
import { createPreferencesPanel } from './preferences-panel';
import type { Preferences } from '../state/preferences';
import { createMailPanel, type MailAction } from './mail-panel';
import { createHelpPanel } from './help-panel';
import { createCreditsPanel } from './credits-panel';
import { createSharePanel } from './share-panel';

interface Actions extends ProgressionActions {
  whisper(): void; buy(index: number): void; format(value: NumberFormat): void;
  mode(value: BuyMode): void; save(): void; upgrade(id: string): void; event(): void;
  prestige(): void; permanent(id: string): void;
  tale: TaleAction;
  preferences(value: Preferences): void;
  mail: MailAction;
}
type Screen = 'main' | 'research' | 'prestige' | 'tale' | 'achievements' | 'statistics' | 'settings' | 'help' | 'credits';

export function createView(app: HTMLElement, state: GameState, actions: Actions) {
  const feedback = createFeedback(() => state.preferences);
  const header = node('header');
  header.append(node('p', ja.district, 'eyebrow'), node('h1', ja.title), node('p', ja.tagline, 'subtitle'));
  const badge = node('p', ja.tainted, 'tainted'); header.append(badge);
  const navigation = node('nav', '', 'tabs'); navigation.setAttribute('aria-label', ja.navigation);
  let screen: Screen = 'main';
  const screens: Screen[] = ['main', 'research', 'prestige', 'tale', 'achievements', 'statistics', 'settings', 'help','credits'];
  const labels = [ja.mainTab, ja.upgradeTab, ja.prestigeTab, ja.taleTab, ja.achievementTab, ja.statistics, ja.settings, ja.helpTitle,ja.creditsTab];
  const tabs = screens.map((target, index) => {
    const button = node('button', labels[index]); button.type = 'button';
    button.addEventListener('click', () => { screen = target; render(); window.scrollTo(0, 0); });
    navigation.append(button); return button;
  });
  navigation.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const available = tabs.filter(tab => !tab.hidden), current = available.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0) return;
    event.preventDefault();
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? available.length - 1
      : (current + (event.key === 'ArrowRight' ? 1 : -1) + available.length) % available.length;
    available[index].focus(); available[index].click();
  });
  const layout = node('div', '', 'layout');
  const board = node('section', '', 'board panel');
  const currency = node('p', '', 'currency'), rate = node('p', '', 'rate');
  const click = node('button', '', 'whisper'); click.type = 'button';
  click.append(artwork('noticeboard', 'board-art', '✉', true), node('span', ja.whisper));
  click.addEventListener('click', actions.whisper);
  const perClick = node('p', '', 'muted'), earned = node('p', '', 'muted small');
  const event = node('button', ja.eventName, 'event-button'); event.type = 'button';
  event.title = ja.eventHint; event.addEventListener('click', actions.event);
  const boost = node('p', '', 'event-boost');
  const taleBoost = node('p', '', 'event-boost');
  header.append(event, boost, taleBoost);
  board.append(node('h2', ja.currency), currency, rate, node('blockquote', ja.rumor), click,
    perClick, node('p', ja.clickHint, 'small muted'), earned);
  const sharing = createSharePanel(state); board.append(sharing.controls);
  const shop = node('section', '', 'shop panel');
  const modes = node('fieldset', '', 'modes'); modes.append(node('legend', ja.buyMode));
  const modeValues: BuyMode[] = [1, 10, 100, 'max'];
  const modeButtons = modeValues.map((mode, i) => {
    const button = node('button', ja.buyModes[i]); button.type = 'button';
    button.addEventListener('click', () => actions.mode(mode)); modes.append(button); return button;
  });
  shop.append(node('h2', ja.producerHeading), node('p', ja.producerIntro, 'muted'), modes);
  const producerList = node('div', '', 'producer-list'); shop.append(producerList);
  const cards = producers.map((_, index) => {
    const card = node('article', '', 'producer');
    const heading = node('h3', '', 'producer-heading'), name = node('span'), art = artwork(producers[index].id, 'producer-art', ja.icons[index]);
    heading.append(art, name); const description = node('p', '', 'description muted');
    const count = node('p', '', 'owned'), output = node('p', '', 'small muted');
    const price = node('p', '', 'price'), wait = node('p', '', 'small muted');
    const button = node('button', '', 'buy'); button.type = 'button';
    const buyName = node('span',ja.buy,'buy-name'), buyQuantity = node('span','','buy-quantity'); button.append(buyName,buyQuantity);
    button.addEventListener('click', () => actions.buy(index));
    const progress = node('progress'); progress.max = 1;
    progress.setAttribute('aria-label', `${ja.producerNames[index]} / ${ja.price}`);
    card.append(heading, description, count, output, price, progress, wait, button); producerList.append(card);
    return { card, heading, art, name, description, count, output, price, wait, button, buyQuantity, progress };
  });
  const panels = createProgressPanels(state, actions.upgrade);
  const prestige = createPrestigePanel(state, actions.prestige, actions.permanent);
  const prestigeContent = node('section','','prestige-run'); prestigeContent.append(...prestige.panel.childNodes);
  prestige.panel.classList.add('prestige-panel');
  const myth = createMythPanel(state, actions); prestige.panel.append(prestigeContent,myth.panel);
  const tale = createTalePanel(state, actions.tale);
  const taleContent = node('section','','tale-game'); taleContent.append(...tale.panel.childNodes);
  const mail = createMailPanel(state, actions.mail); tale.panel.append(taleContent,mail.panel);
  layout.append(board, shop, panels.research);
  const settings = node('section', '', 'panel settings'); settings.append(node('h2', ja.settings));
  const label = node('label', ja.notation), formatSelect = node('select');
  const formats: NumberFormat[] = ['ja', 'en', 'scientific'];
  formats.forEach((format, i) => {
    const option = node('option', ja.formats[i]); option.value = format; formatSelect.append(option);
  });
  formatSelect.value = state.format;
  formatSelect.addEventListener('change', () => actions.format(formatSelect.value as NumberFormat)); label.append(formatSelect);
  const save = node('button', ja.save); save.type = 'button'; save.addEventListener('click', actions.save);
  settings.append(label, save, node('p', ja.autosave, 'small muted'));
  const preferences = createPreferencesPanel(() => state.preferences, actions.preferences); settings.append(preferences.panel);
  const message = node('p', '', 'message'); message.setAttribute('role', 'status');
  const help = createHelpPanel();
  const credits = createCreditsPanel(), bottom=node('div','','bottom-bar'), footer=node('footer','','site-credit');
  const creatorLink=node('button',ja.creditsTitle); creatorLink.type='button';
  creatorLink.addEventListener('click',()=>{screen='credits';render();window.scrollTo(0,0);tabs.at(-1)?.focus();});
  footer.append(node('span',ja.creditShort),creatorLink); bottom.append(message,footer);
  app.replaceChildren(header, navigation, layout, prestige.panel, tale.panel, panels.achievementPanel, panels.statistics,
    settings, help, credits, bottom);

  function render() {
    feedback.apply(); preferences.render(); sharing.render();
    const fmt = (value: Decimal) => formatNumber(value, state.format);
    const total = production(state);
    const enabled = [true, state.earned.gte(balance.researchUnlock),
      state.earned.gte(prestigeBalance.preview) || state.prestige.count > 0 || state.myth.count > 0, state.tale.unlocked || state.myth.count > 0, state.achievements.length > 0,
      state.earned.gte(balance.statisticsUnlock) || state.tainted || state.prestige.count > 0, true, true, true];
    if (!enabled[screens.indexOf(screen)]) screen = 'main';
    if (app.dataset.screen !== screen) app.dataset.screen = screen;
    tabs.forEach((tab, index) => {
      setHidden(tab, !enabled[index]);
      const pressed = String(screen === screens[index]);
      if (tab.getAttribute('aria-pressed') !== pressed) tab.setAttribute('aria-pressed', pressed);
    });
    setHidden(layout, screen !== 'main' && screen !== 'research');
    setHidden(board, screen !== 'main'); setHidden(shop, screen !== 'main');
    setHidden(panels.research, !enabled[1] || (screen !== 'main' && screen !== 'research'));
    const layoutClass = screen === 'research' ? 'layout research-only' : enabled[1] ? 'layout' : 'layout intro-layout';
    if (layout.className !== layoutClass) layout.className = layoutClass;
    setHidden(panels.achievementPanel, screen !== 'achievements');
    setHidden(prestige.panel, screen !== 'prestige');
    setHidden(tale.panel, screen !== 'tale');
    setHidden(panels.statistics, screen !== 'statistics'); setHidden(settings, screen !== 'settings');
    setHidden(help, screen !== 'help');
    setHidden(credits, screen !== 'credits');
    setHidden(badge, !state.tainted);
    if (formatSelect.value !== state.format) formatSelect.value = state.format;
    updateText(currency, fmt(state.currency)); updateText(rate, `${ja.rate} ${fmt(total)} ${ja.currency}`);
    updateText(perClick, ja.clickLabel(fmt(clickGain(state)))); updateText(earned, ja.earnedLabel(fmt(state.earned)));
    if (click.disabled !== (state.challenge.active === 'silent')) click.disabled = state.challenge.active === 'silent';
    setHidden(event, state.events.visible <= 0);
    updateText(event, `${ja.eventName} / ${ja.eventRemaining(Math.ceil(state.events.visible))}`);
    setHidden(boost, state.events.boost <= 0); updateText(boost, ja.eventBoost(Math.ceil(state.events.boost)));
    setHidden(taleBoost, state.tale.boost <= 0); updateText(taleBoost, ja.taleBoost(Math.ceil(state.tale.boost)));
    modeButtons.forEach((button, i) => {
      const pressed = String(state.buyMode === modeValues[i]);
      if (button.getAttribute('aria-pressed') !== pressed) button.setAttribute('aria-pressed', pressed);
    });
    cards.forEach((card, index) => {
      const revealed = unlocked(state, index);
      const visible = revealed || (index > 0 && unlocked(state, index - 1));
      setHidden(card.card, !visible); if (!visible) return;
      const description = revealed ? ja.producerDescriptions[index] : '';
      if (card.heading.title !== description) card.heading.title = description;
      updateText(card.name, revealed ? ja.producerNames[index] : ja.unknown); setHidden(card.art, !revealed);
      updateText(card.description, revealed ? ja.producerUnitEffect(fmt(unitRate(state,index))) +
        (chainActive(state) && index > 0 ? ja.producerChainEffect(mythBalance.chainRate.toString()) : '') : ja.unknownHint);
      for (const element of [card.count, card.output, card.price, card.progress, card.button]) setHidden(element, !revealed);
      if (!revealed) {
        updateText(card.wait, ja.nextReveal(ja.producerNames[index - 1], fmt(producers[index].baseCost.mul(balance.revealRatio)))); return;
      }
      const quantity = purchaseQuantity(state, index, state.buyMode);
      const price = cost(state, index, Math.max(1, quantity)), output = producerRate(state, index);
      updateText(card.count, ja.generatedLabel(state.owned[index].toString(), fmt(state.generated[index]))); updateText(card.output, ja.rateLabel(fmt(output)));
      if (card.count.title !== card.count.textContent) card.count.title = card.count.textContent ?? '';
      const tooltip = ja.contributionLabel(total.eq(0) ? '0' : output.div(total).mul(100).toFixed(1));
      if (card.output.title !== tooltip) card.output.title = tooltip;
      updateText(card.price, `${ja.price} ${fmt(price)}`);
      const progress = Decimal.min(1, state.currency.div(price)).toNumber();
      if (card.progress.value !== progress) card.progress.value = progress;
      const affordable = quantity > 0 && state.currency.gte(price);
      if (card.button.disabled === affordable) card.button.disabled = !affordable;
      const buyLabel = ja.buyLabel(ja.producerNames[index], Math.max(1, quantity));
      if (card.button.getAttribute('aria-label') !== buyLabel) card.button.setAttribute('aria-label', buyLabel);
      updateText(card.buyQuantity, `×${fmt(new Decimal(Math.max(1,quantity)))}`);
      updateText(card.wait, affordable ? ja.ready : total.gt(0)
        ? ja.wait(fmt(price.sub(state.currency).div(total).ceil())) : ja.clickToEarn);
    });
    panels.render();
    prestige.render();
    myth.render();
    tale.render();
    mail.render();
    if (state.currency.gt(0)) {
      const tier = state.currency.log10().div(4).floor();
      if (tier.gt(lastTier)) feedback.pulse(currency);
      lastTier = tier;
    }
  }
  let lastTier = new Decimal(0);
  return { render, notify: (text: string) => updateText(message, text),
    celebrate(kind: 'click' | 'buy' | 'research' | 'event' | 'achievement' | 'reset', index?: number) {
      const target = kind === 'buy' && index !== undefined ? cards[index].card : board;
      feedback.pulse(target);
      if (kind === 'click') feedback.float(click, `+${formatNumber(clickGain(state), state.format)}`);
    },
    attachSavePanel: (panel: HTMLElement) => settings.append(panel) };
}
