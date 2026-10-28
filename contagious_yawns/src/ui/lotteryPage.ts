import { LOTTERY, LOTTERY_CONSOLATION, LOTTERY_REWARDS, LOTTERY_SYMBOLS, type LotteryReward, type LotterySymbol } from '../data/lottery';
import { ja, t } from '../i18n/ja';
import { currentDraw, lotteryUnlocked, type LotteryPrize } from '../minigames/lottery';
import type { GameState, Notation } from '../state/gameState';
import { el, setAttr, setHidden, setText } from './dom';
import { formatNumber } from './format';
import { setIcon } from './icons';

export interface LotteryPageHandlers {
  onDraw(): void;
  onRespin(held: readonly boolean[]): void;
  onSettle(): void;
}

export interface LotteryPage {
  readonly root: HTMLElement;
  render(state: GameState): void;
}

const isSymbol = (s: string): s is LotterySymbol => LOTTERY_SYMBOLS.some((id) => id === s);
const icon = (s: string): string => (isSymbol(s) ? LOTTERY.icons[s] : '？');
const symbolName = (s: string): string => (isSymbol(s) ? ja.lottery.symbols[s] : '？');

/** 報酬の説明（そろえたときの表・結果の通知に使う）。 */
export function lotteryRewardText(r: LotteryReward): string {
  const w = ja.lottery.rewards;
  switch (r.kind) {
    case 'production':
      return t(w.production, { m: r.durationMs / 60_000, f: r.factor });
    case 'click':
      return t(w.click, { s: r.durationMs / 1000, f: r.factor });
    case 'instant':
      return t(w.instant, { m: r.seconds / 60 });
    case 'pillows':
      return t(w.pillows, { n: r.count });
    case 'star':
      return w.star;
    case 'shards':
      return t(w.shards, { p: Math.round(r.fraction * 100) });
  }
}

/** 引いた結果の通知文。 */
export function lotteryPrizeText(prize: LotteryPrize, notation: Notation): string {
  const l = ja.lottery;
  let got = lotteryRewardText(prize.reward);
  if (prize.yawns) got = t(l.gotYawns, { n: formatNumber(prize.yawns, notation) });
  else if (prize.reward.kind === 'shards') got = t(l.gotShards, { n: prize.shards });
  else if (prize.reward.kind === 'pillows') got = prize.pillows > 0 ? t(l.gotPillows, { n: prize.pillows }) : l.pillowsFull;
  const line = prize.match === 3 ? l.resultThree : prize.match === 2 ? l.resultTwo : l.resultNone;
  return t(l.result, { reels: prize.reels.map(icon).join(''), r: t(line, { r: got }) });
}

/** 夢くじ（DESIGN.md §16）：券・3つのリール・回し直し・そろえたときの表。ひつじ牧場のタブの中に置く。 */
export function createLotteryPage(handlers: LotteryPageHandlers): LotteryPage {
  const root = el('div', 'lottery-page');
  root.append(el('h2', '', ja.lottery.heading), el('p', 'page-summary', ja.lottery.intro));

  const tickets = el('p', 'lottery-tickets');
  const locked = el('p', 'lottery-locked');
  const draw = el('button', 'button button-primary lottery-draw', ja.lottery.draw);
  draw.type = 'button';
  draw.addEventListener('click', handlers.onDraw);
  const reason = el('p', 'lottery-reason', ja.lottery.noTicket);

  // 引いている途中だけ出す：リール（押すと「残す」を切り替え）・回し直し・決める
  const play = el('div', 'lottery-play');
  const reelBox = el('div', 'lottery-reels');
  const held = Array.from({ length: LOTTERY.reels }, () => false);
  const reels = held.map((_, i) => {
    const b = el('button', 'lottery-reel');
    b.type = 'button';
    const symbol = el('span', 'lottery-symbol');
    symbol.setAttribute('aria-hidden', 'true');
    b.append(symbol, el('span', 'lottery-hold'));
    b.addEventListener('click', () => {
      held[i] = !held[i];
      paintHolds();
    });
    reelBox.append(b);
    return b;
  });
  const respin = el('button', 'button lottery-respin');
  respin.type = 'button';
  respin.addEventListener('click', () => handlers.onRespin([...held]));
  const settle = el('button', 'button button-primary lottery-settle', ja.lottery.settle);
  settle.type = 'button';
  settle.addEventListener('click', handlers.onSettle);
  const actions = el('div', 'lottery-actions');
  actions.append(respin, settle);
  play.append(reelBox, el('p', 'lottery-hint', ja.lottery.holdHint), actions);

  const table = el('ul', 'lottery-table');
  for (const id of LOTTERY_SYMBOLS) {
    const r = LOTTERY_REWARDS[id];
    table.append(
      el('li', '', t(ja.lottery.paytable, { icon: LOTTERY.icons[id], three: lotteryRewardText(r.three), two: lotteryRewardText(r.two) })),
    );
  }
  table.append(el('li', '', t(ja.lottery.consolation, { r: lotteryRewardText(LOTTERY_CONSOLATION) })));
  const stats = el('p', 'lottery-stats');
  root.append(tickets, locked, draw, reason, play, el('h3', '', ja.lottery.paytableHeading), table, stats);

  /** 出目が変わったら「残す」の選択を外す（回し直しのたびに選び直す） */
  let shownKey = '';
  let respinsLeft = 0;
  let shown: readonly string[] = [];

  function paintHolds(): void {
    reels.forEach((b, i) => {
      const on = held[i] === true;
      b.classList.toggle('is-held', on);
      setAttr(b, 'aria-pressed', String(on));
      const hold = b.lastElementChild;
      if (hold instanceof HTMLElement) setText(hold, on ? ja.lottery.held : ja.lottery.hold);
      const name = symbolName(shown[i] ?? '');
      setAttr(b, 'aria-label', t(ja.lottery.reelLabel, { i: i + 1, s: name, held: on ? ja.lottery.keptLabel : ja.lottery.freeLabel }));
    });
    // 全部残すなら回し直す意味がない
    setAttr(respin, 'aria-disabled', String(respinsLeft <= 0 || held.every(Boolean)));
  }

  return {
    root,
    render(state) {
      const l = state.minigames.lottery;
      const unlocked = lotteryUnlocked(state);
      setText(tickets, t(ja.lottery.tickets, { n: l.tickets, max: LOTTERY.ticketsMax }));
      setText(locked, t(ja.lottery.locked, { n: LOTTERY.unlockPrestiges, c: state.prestige.count }));
      setHidden(locked, unlocked);

      const now = currentDraw(state);
      setHidden(draw, now !== null || !unlocked);
      setHidden(reason, now !== null || !unlocked || l.tickets > 0);
      setAttr(draw, 'aria-disabled', String(l.tickets < 1));
      setHidden(play, now === null);
      setText(stats, t(ja.lottery.stats, { p: l.plays, j: l.jackpots }));
      if (!now) {
        shownKey = '';
        return;
      }
      respinsLeft = now.respinsLeft;
      const key = `${l.active?.seed ?? 0}|${now.reels.join(',')}|${now.respinsLeft}`;
      if (key !== shownKey) {
        shownKey = key;
        held.fill(false);
        shown = now.reels;
        reels.forEach((b, i) => {
          const id = now.reels[i] ?? '';
          const symbol = b.firstElementChild;
          if (symbol instanceof HTMLElement) setIcon(symbol, 'lottery', id, icon(id));
        });
        root.classList.remove('is-spun');
        void root.offsetWidth;
        root.classList.add('is-spun');
      }
      setText(respin, t(ja.lottery.respin, { n: now.respinsLeft }));
      paintHolds();
    },
  };
}
