import { ja } from '../i18n/ja';
import { taleBalance as b } from '../data/tale';
import { taleCost, taleAvailable } from '../minigames/tale/game';
import type { TaleChoice } from '../minigames/tale/state';
import type { GameState } from '../state/game';
import { formatNumber } from './format';
import { node, setHidden, updateText } from './dom';
import { assetImage } from './assets';

export type TaleAction = (operation: 'start' | 'continue' | 'bank', choice?: TaleChoice) => void;
export function createTalePanel(state: GameState, action: TaleAction) {
  const panel = node('section', '', 'panel tale-panel');
  const tickets = node('p', '', 'price'), fee = node('p'), wallet = node('p'), stage = node('h3'), status = node('p');
  status.setAttribute('role', 'status');
  const story = node('blockquote'), timer = node('p'), progress = node('progress');
  progress.max = b.stageSeconds; progress.setAttribute('aria-label', ja.taleTitle);
  const result = node('p'), record = node('p', '', 'small muted');
  const choices = node('div', '', 'tale-choices');
  const buttons = (['safe', 'bold'] as const).map(choice => {
    const row = node('article', '', 'tale-choice');
    const button = node('button'); button.type = 'button';
    button.setAttribute('aria-label', choice === 'safe' ? ja.taleSafe : ja.taleBold);
    button.addEventListener('click', () => action(state.tale.round ? 'continue' : 'start', choice));
    row.append(node('h3', choice === 'safe' ? ja.taleSafe : ja.taleBold), button); choices.append(row);
    return button;
  });
  const bank = node('button', ja.taleBank, 'whisper'); bank.type = 'button'; bank.addEventListener('click', () => action('bank'));
  const illustration = node('figure', '', 'tale-illustration');
  const placeholder = assetImage('tale', 'tale-art');
  illustration.append(placeholder, node('figcaption', ja.taleIllustrationTitle), node('p', ja.taleIllustrationText));
  const collectionHint = node('p', ja.taleIllustrationHint, 'muted');
  panel.append(node('h2', ja.taleTitle), node('p', ja.taleIntro), node('p', ja.taleRules),
    tickets, fee, wallet, node('p', ja.taleUnlockHint, 'small muted'), node('p', ja.taleReward), node('p', ja.taleStack, 'small muted'),
    stage, status, story, timer, progress, result, choices, bank, record, collectionHint, illustration);
  function render() {
    const t = state.tale, r = t.round;
    updateText(tickets, ja.taleTickets(t.tickets, Math.ceil(b.rechargeSeconds - t.recharge)));
    updateText(fee, ja.taleCost(formatNumber(taleCost(state), state.format)));
    updateText(wallet, `${ja.statsBalance}：${formatNumber(state.currency, state.format)}${ja.currency}`);
    setHidden(stage, !r); setHidden(story, !r); setHidden(timer, r?.phase !== 'running');
    setHidden(progress, r?.phase !== 'running'); setHidden(bank, r?.phase !== 'decision');
    if (r) {
      updateText(stage, ja.taleStage(r.stage + 1, r.points));
      updateText(story, ja.taleStories[r.stage]);
      updateText(status, r.phase === 'decision' ? ja.taleDecision : '');
      updateText(timer, ja.taleWaiting(Math.ceil(r.remaining)));
      const value = b.stageSeconds - r.remaining; if (progress.value !== value) progress.value = value;
    } else updateText(status, '');
    updateText(result, t.lastOutcome === 'failure' ? ja.taleFailure : t.lastOutcome === 'banked' ? ja.taleResult(t.lastPoints) : '');
    buttons.forEach(button => {
      updateText(button, r ? ja.taleContinue : ja.taleStart);
      const disabled = r ? r.phase !== 'decision' : !taleAvailable(state) || t.tickets < 1 || state.currency.lt(taleCost(state));
      if (button.disabled !== disabled) button.disabled = disabled;
    });
    updateText(record, ja.taleRecord(t.plays, t.wins, t.bestPoints));
    setHidden(illustration, !t.illustration); setHidden(collectionHint, t.illustration);
  }
  return { panel, render };
}
