import { PRODUCERS, type ProducerDef, type ProducerId } from '../data/producers';
import { ja, t } from '../i18n/ja';
import { BUY_AMOUNTS, type BuyAmount, type GameState } from '../state/gameState';
import {
  producerRate,
  producerShare,
  rateEach,
  secondsUntil,
  totalRate,
} from '../systems/production';
import { bulkCost, displayCount, priceMultiplier, purchaseCount } from '../systems/purchase';
import { autoBuyTargets } from '../systems/dreamTree';
import { producerVisibility } from '../systems/unlock';
import { el, replayAnimation, setAttr, setHidden, setText } from './dom';
import { formatDuration, formatNumber } from './format';
import { iconSpan } from './icons';

export interface ProducerListHandlers {
  onBuy(id: ProducerId): void;
  onBuyAmount(amount: BuyAmount): void;
  onToggleAuto(): void;
}

export interface ProducerList {
  readonly root: HTMLElement;
  render(state: GameState): void;
}

interface Row {
  def: ProducerDef;
  item: HTMLLIElement;
  button: HTMLButtonElement;
  teaser: HTMLDivElement;
  owned: HTMLSpanElement;
  infected: HTMLSpanElement;
  cost: HTMLSpanElement;
  count: HTMLSpanElement;
  rate: HTMLSpanElement;
  eta: HTMLSpanElement;
  /** 前に描いたときの所持数（増えたら光らせる。-1 はまだ描いていない） */
  lastOwned: number;
}

function createRow(def: ProducerDef, onBuy: (id: ProducerId) => void): Row {
  const text = ja.producers[def.id];
  const item = el('li', 'producer-item');

  const button = el('button', 'producer');
  button.type = 'button';
  const icon = iconSpan('producer-icon', 'producers', def.id, def.icon);
  const main = el('span', 'producer-main');
  const name = el('span', 'producer-name', text.name);
  const desc = el('span', 'producer-desc', text.desc);
  const rate = el('span', 'producer-rate');
  main.append(name, desc, rate);
  const side = el('span', 'producer-side');
  const owned = el('span', 'producer-owned', '0');
  owned.setAttribute('aria-label', ja.ownedLabel);
  const price = el('span', 'producer-price');
  const count = el('span', 'producer-count');
  const cost = el('span', 'producer-cost');
  price.append(count, cost);
  const eta = el('span', 'producer-eta');
  // 眠気の連鎖でうつった数（あれば）
  const infected = el('span', 'producer-infected');
  infected.hidden = true;
  side.append(owned, infected, price, eta);
  button.append(icon, main, side);
  button.addEventListener('click', () => onBuy(def.id));

  const teaser = el('div', 'producer teaser');
  const teaserIcon = el('span', 'producer-icon', '？');
  teaserIcon.setAttribute('aria-hidden', 'true');
  const teaserMain = el('span', 'producer-main');
  teaserMain.append(
    el('span', 'producer-name', ja.teaserName),
    el('span', 'producer-desc', ja.teaserHint),
  );
  teaser.append(teaserIcon, teaserMain);

  item.append(button, teaser);
  return { def, item, button, teaser, owned, infected, cost, count, rate, eta, lastOwned: -1 };
}

export function createProducerList(handlers: ProducerListHandlers): ProducerList {
  const root = el('section', 'panel producer-panel');
  const header = el('div', 'panel-header');
  const heading = el('h2', '', ja.producersHeading);

  const amountGroup = el('div', 'amount-group');
  amountGroup.setAttribute('role', 'group');
  amountGroup.setAttribute('aria-label', ja.buyAmountLabel);
  const amountButtons = BUY_AMOUNTS.map((amount) => {
    const b = el('button', 'amount-button', ja.buyAmount[amount]);
    b.type = 'button';
    b.addEventListener('click', () => handlers.onBuyAmount(amount));
    amountGroup.append(b);
    return { amount, b };
  });
  // 自動購入（夢ツリーで解放）の ON/OFF
  const auto = el('button', 'auto-toggle');
  auto.type = 'button';
  auto.hidden = true;
  auto.addEventListener('click', handlers.onToggleAuto);
  header.append(heading, auto, amountGroup);

  const list = el('ul', 'producer-list');
  const rows = PRODUCERS.map((def) => createRow(def, handlers.onBuy));
  list.append(...rows.map((r) => r.item));
  root.append(header, list);

  return {
    root,
    render(state) {
      const { notation, buyAmount } = state.settings;
      setHidden(auto, autoBuyTargets(state).size === 0);
      setText(auto, `${ja.dream.autoBuy}：${state.settings.autoBuy ? ja.dream.on : ja.dream.off}`);
      setAttr(auto, 'aria-pressed', String(state.settings.autoBuy));
      for (const { amount, b } of amountButtons) {
        setAttr(b, 'aria-pressed', String(amount === buyAmount));
      }

      const visibility = producerVisibility(state);
      const income = totalRate(state);
      for (const row of rows) {
        const v = visibility[row.def.id];
        setHidden(row.item, v === 'hidden');
        setHidden(row.button, v !== 'visible');
        setHidden(row.teaser, v !== 'teaser');
        if (v !== 'visible') continue;

        const owned = state.producers[row.def.id].bought;
        const mult = priceMultiplier(state);
        const n = displayCount(row.def, owned, state.yawns, buyAmount, mult);
        const cost = bulkCost(row.def, owned, n, mult);
        const canBuy =
          purchaseCount(row.def, owned, state.yawns, buyAmount, mult) > 0 && cost.lte(state.yawns);

        setText(row.owned, String(owned));
        if (row.lastOwned >= 0 && owned > row.lastOwned) replayAnimation(row.button, 'bought');
        row.lastOwned = owned;
        const infected = state.producers[row.def.id].infected;
        setHidden(row.infected, infected.lt(1));
        if (infected.gte(1)) setText(row.infected, t(ja.infected, { n: formatNumber(infected.floor(), notation) }));
        setText(row.count, t(ja.buyCount, { n }));
        // 切り捨てだと「表示額はあるのに買えない」が起きるので、価格は切り上げて見せる
        setText(row.cost, formatNumber(cost.ceil(), notation));

        const each = t(ja.rateEach, { n: formatNumber(rateEach(state, row.def.id), notation, true) });
        const sum = t(ja.rateTotal, { n: formatNumber(producerRate(state, row.def.id), notation, true) });
        setText(row.rate, producerRate(state, row.def.id).gt(0) ? `${each} ／ ${sum}` : each);

        const wait = secondsUntil(state.yawns, cost, income);
        setText(
          row.eta,
          canBuy ? ja.affordable : Number.isFinite(wait) ? t(ja.eta, { t: formatDuration(wait) }) : ja.etaNever,
        );
        row.button.classList.toggle('is-affordable', canBuy);
        setAttr(row.button, 'aria-disabled', String(!canBuy));
        const share = Math.round(producerShare(state, row.def.id) * 1000) / 10;
        setAttr(row.button, 'title', t(ja.shareTooltip, { p: share }));
      }
    },
  };
}
