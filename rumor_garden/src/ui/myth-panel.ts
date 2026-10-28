import { ja } from '../i18n/ja';
import { challengeIds, mythBalance, type ChallengeId } from '../data/myth';
import { producers } from '../data/balance';
import type { GameState } from '../state/game';
import { canCompileMyth, canStartChallenge } from '../systems/myth';
import { mythMultiplier } from '../systems/economy';
import type { AutomationCommand } from '../systems/automation';
import { formatNumber } from './format';
import { node, updateText, setHidden } from './dom';

export interface ProgressionActions {
  progression(operation: 'myth' | 'start' | 'abandon' | 'complete', id?: ChallengeId): void;
  automation(command: AutomationCommand): void;
}
export function createMythPanel(state: GameState, actions: ProgressionActions) {
  const disable = (button: HTMLButtonElement, value: boolean) => { if (button.disabled !== value) button.disabled = value; };
  const panel = node('section', '', 'myth-panel');
  const status = node('p'), compile = node('button', ja.mythButton, 'whisper'); compile.type = 'button';
  compile.addEventListener('click', () => actions.progression('myth'));
  panel.append(node('h2', ja.mythTitle), node('p', ja.mythIntro), status, node('p', ja.mythRequirement),
    node('p', ja.mythReset, 'small muted'), node('p', ja.mythUnlocks), compile);
  const challenges = node('section'); const current = node('p'); current.setAttribute('role', 'status');
  challenges.append(node('h3', ja.challengeTitle), node('p', ja.challengeRule), current);
  const rows = challengeIds.map((id, i) => {
    const row = node('article', '', 'research-row'), done = node('p');
    const start = node('button', ja.challengeStart); start.type = 'button';
    start.setAttribute('aria-label', `${ja.challengeStart}：${ja.challengeNames[i]}`);
    start.addEventListener('click', () => actions.progression('start', id));
    row.append(node('h3', ja.challengeNames[i]), node('p', ja.challengeDescriptions[i]), done, start); challenges.append(row);
    return { start, done };
  });
  const finish = node('button', ja.challengeFinish), abandon = node('button', ja.challengeAbandon);
  finish.type = abandon.type = 'button';
  finish.addEventListener('click', () => actions.progression('complete'));
  abandon.addEventListener('click', () => actions.progression('abandon'));
  challenges.append(finish, abandon); panel.append(challenges);
  const automation = node('section'); automation.append(node('h3', ja.automationTitle), node('p', ja.automationHint));
  const toggles = (['purchase', 'research', 'prestige'] as const).map((target, i) => {
    const label = node('label', ja.automationNames[i]), input = node('input'); input.type = 'checkbox';
    input.addEventListener('change', () => actions.automation({ kind: 'toggle', target, enabled: input.checked }));
    label.prepend(input); automation.append(label); return { input, label };
  });
  const fields = (['reserve', 'threshold'] as const).map(target => {
    const group = node('div'); let dirty = false;
    const label = node('label', target === 'reserve' ? ja.automationReserve : ja.automationThreshold), input = node('input');
    input.type = 'text'; input.inputMode = 'decimal'; input.maxLength = 10000;
    const apply = node('button', ja.automationApply); apply.type = 'button';
    apply.setAttribute('aria-label', `${ja.automationApply}：${target === 'reserve' ? ja.automationReserve : ja.automationThreshold}`);
    const commit = () => { dirty = false; actions.automation({ kind: 'number', target, value: input.value }); };
    input.addEventListener('input', () => { dirty = true; }); apply.addEventListener('click', commit);
    input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); commit(); } });
    label.append(input); group.append(label, apply); automation.append(group); return { label: group, input, target, dirty: () => dirty, reset: () => { dirty = false; } };
  });
  const order = node('div', '', 'automation-order');
  const targets = producers.map((_, index) => {
    const row = node('div', '', 'automation-row'), label = node('label', ja.producerNames[index]), input = node('input');
    input.type = 'checkbox'; input.addEventListener('change', () => actions.automation({ kind: 'target', index, enabled: input.checked }));
    label.prepend(input);
    const up = node('button', '↑'), down = node('button', '↓'); up.type = down.type = 'button';
    up.setAttribute('aria-label', `${ja.automationUp}：${ja.producerNames[index]}`);
    down.setAttribute('aria-label', `${ja.automationDown}：${ja.producerNames[index]}`);
    up.addEventListener('click', () => actions.automation({ kind: 'move', index, offset: -1 }));
    down.addEventListener('click', () => actions.automation({ kind: 'move', index, offset: 1 }));
    row.append(label, up, down); order.append(row); return { row, input, up, down };
  });
  automation.append(order); panel.append(automation);
  let shownAutomation = state.automation;
  function render() {
    if (shownAutomation !== state.automation) { fields.forEach(field => field.reset()); shownAutomation = state.automation; }
    updateText(status, ja.mythStatus(state.myth.count, formatNumber(mythMultiplier(state), state.format)));
    disable(compile, !canCompileMyth(state));
    setHidden(challenges, state.myth.count < 1); setHidden(automation, state.myth.count < 1);
    updateText(current, state.challenge.active ? `${ja.challengeActive(ja.challengeNames[challengeIds.indexOf(state.challenge.active)])}・${ja.challengeProgress(formatNumber(state.earned, state.format))}` : ja.challengeInactive);
    rows.forEach((row, i) => { disable(row.start, !canStartChallenge(state, challengeIds[i]));
      updateText(row.done, state.challenge.completed.includes(challengeIds[i]) ? ja.challengeCompleted : ''); });
    setHidden(finish, !state.challenge.active); setHidden(abandon, !state.challenge.active);
    disable(finish, state.earned.lt(mythBalance.challengeGoal));
    toggles.forEach((toggle, i) => { const target = (['purchase', 'research', 'prestige'] as const)[i];
      setHidden(toggle.label, state.myth.count < i + 1); if (toggle.input.checked !== state.automation[target]) toggle.input.checked = state.automation[target]; });
    fields.forEach(field => {
      setHidden(field.label, field.target === 'threshold' && state.myth.count < mythBalance.prestigeUnlock);
      if (!field.dirty() && document.activeElement !== field.input && field.input.value !== state.automation[field.target].toString()) field.input.value = state.automation[field.target].toString();
    });
    targets.forEach((target, i) => {
      const position = state.automation.order.indexOf(i), order = String(position);
      if (target.row.style.order !== order) target.row.style.order = order;
      if (target.input.checked !== state.automation.targets[i]) target.input.checked = state.automation.targets[i];
      disable(target.up, position === 0); disable(target.down, position === producers.length - 1);
    });
  }
  return { panel, render };
}
