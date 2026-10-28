import Decimal from 'break_eternity.js';
import { CHALLENGES, type ChallengeDef, type ChallengeReward, type ChallengeRule } from '../data/challenges';
import { ja, t } from '../i18n/ja';
import type { GameState } from '../state/gameState';
import { activeChallenge, activeRule, challengeProgress } from '../systems/challenges';
import { el, setText } from './dom';
import { formatDuration, formatNumber } from './format';
import { iconSpan } from './icons';

export interface ChallengesPageHandlers {
  onStart(id: string): void;
  onAbandon(): void;
}

export interface ChallengesPage {
  readonly root: HTMLElement;
  render(state: GameState): void;
}

const names = (ids: readonly string[]): string =>
  ids.map((id) => (ja.producers as Record<string, { name: string }>)[id]?.name ?? id).join('・');

export function challengeName(def: ChallengeDef): string {
  return ja.challenge.names[def.id] ?? def.id;
}

export function ruleText(rule: ChallengeRule): string {
  const r = ja.challenge.rules;
  switch (rule.kind) {
    case 'production':
      return t(r.production, { f: rule.factor });
    case 'noStars':
      return r.noStars;
    case 'noClicks':
      return t(r.noClicks, { n: rule.startCats });
    case 'onlyProducers':
      return t(r.onlyProducers, { list: names(rule.targets) });
    case 'priceMultiplier':
      return t(r.priceMultiplier, { f: rule.factor });
    case 'oscillate':
      return t(r.oscillate, { s: rule.periodMs / 1000, min: rule.min, max: rule.max });
    case 'timeLimit':
      return t(r.timeLimit, { m: rule.ms / 60_000 });
    case 'noUpgrades':
      return r.noUpgrades;
  }
}

export function rewardText(reward: ChallengeReward): string {
  const r = ja.challenge.rewards;
  switch (reward.kind) {
    case 'click':
      return t(r.click, { f: reward.factor });
    case 'starInterval':
      return t(r.starInterval, { p: Math.round((1 - reward.factor) * 100) });
    case 'offlineEfficiency':
      return t(r.offlineEfficiency, { p: Math.round(reward.amount * 100) });
    case 'producers':
      return t(r.producers, { list: names(reward.targets), f: reward.factor });
    case 'priceMultiplier':
      return t(r.priceMultiplier, { f: reward.factor });
    case 'chain':
      return t(r.chain, { f: reward.factor });
    case 'startYawns':
      return t(r.startYawns, { n: formatNumber(new Decimal(reward.amount), 'ja') });
    case 'production':
      return t(r.production, { f: reward.factor });
  }
}

/** クリック面に出す、挑戦中の1行。挑戦していなければ null。 */
export function challengeLine(state: GameState): string | null {
  const c = activeChallenge(state);
  if (!c) return null;
  let line = t(ja.challenge.progress, {
    name: challengeName(c),
    p: Math.floor(challengeProgress(state) * 100),
    n: formatNumber(new Decimal(c.goal), state.settings.notation),
  });
  const limit = activeRule(state, 'timeLimit');
  if (limit) line += t(ja.challenge.timeLeft, { t: formatDuration(Math.max(0, limit.ms - state.playTimeMs) / 1000) });
  return line;
}

/** 眠れない夜（チャレンジ一覧）。 */
export function createChallengesPage(handlers: ChallengesPageHandlers): ChallengesPage {
  const root = el('section', 'panel page-panel challenges-page');
  root.append(el('h2', '', ja.challenge.heading), el('p', 'page-summary', ja.challenge.intro));
  const summary = el('p', 'challenge-summary');
  const list = el('ul', 'challenge-list');
  root.append(summary, list);

  let key = '';

  return {
    root,
    render(state) {
      const { active, completed } = state.challenges;
      setText(summary, t(ja.challenge.summary, { n: completed.size, total: CHALLENGES.length }));
      const nextKey = `${active}|${[...completed].sort().join(',')}|${state.settings.notation}`;
      if (nextKey === key) return;
      key = nextKey;

      list.replaceChildren(
        ...CHALLENGES.map((def) => {
          const done = completed.has(def.id);
          const isActive = active === def.id;
          const li = el('li', `challenge${done ? ' is-done' : ''}${isActive ? ' is-active' : ''}`);
          const icon = iconSpan('challenge-icon', 'challenges', def.id, def.icon);
          const text = el('div', 'challenge-text');
          text.append(
            el('span', 'challenge-name', challengeName(def)),
            el('span', 'challenge-detail', t(ja.challenge.rule, { r: ruleText(def.rule) })),
            el('span', 'challenge-detail', t(ja.challenge.goal, { n: formatNumber(new Decimal(def.goal), state.settings.notation) })),
            el('span', 'challenge-detail', t(ja.challenge.reward, { r: rewardText(def.reward) })),
          );
          let action: HTMLElement;
          if (done) action = el('span', 'challenge-status', `✓ ${ja.challenge.completed}`);
          else if (isActive) {
            const b = el('button', 'button button-danger', ja.challenge.abandon);
            b.type = 'button';
            b.addEventListener('click', handlers.onAbandon);
            action = el('div', 'challenge-actions');
            action.append(el('span', 'challenge-status', ja.challenge.active), b);
          } else {
            const b = el('button', 'button button-primary', ja.challenge.start);
            b.type = 'button';
            if (active !== null) b.setAttribute('aria-disabled', 'true');
            b.addEventListener('click', () => handlers.onStart(def.id));
            action = b;
          }
          li.append(icon, text, action);
          return li;
        }),
      );
    },
  };
}
