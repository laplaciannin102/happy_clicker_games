import Decimal from 'break_eternity.js';
import { ACHIEVEMENTS, ACHIEVEMENT_BONUS } from '../data/achievements';
import { UPGRADES } from '../data/upgrades';
import { ja, t } from '../i18n/ja';
import type { GameState } from '../state/gameState';
import { totalOwned } from '../systems/achievements';
import { clickValue } from '../systems/click';
import { currentSeason } from '../systems/hibernation';
import { seasonLabel } from './hibernationPage';
import { dreamProductionMultiplier, extraAchievementBonus } from '../systems/dreamTree';
import { totalRate } from '../systems/production';
import { el, setText } from './dom';
import { formatDuration, formatNumber } from './format';

export interface StatsPage {
  readonly root: HTMLElement;
  render(state: GameState): void;
}

type Row = [label: string, value: (s: GameState) => string];

/** 睡眠記録（統計）。改造データの印もここに出す（SPEC §6.3-3）。 */
export function createStatsPage(): StatsPage {
  const root = el('section', 'panel page-panel stats-page');
  root.append(el('h2', '', ja.statsHeading));
  const s = ja.stats;
  const num = (st: GameState, v: Parameters<typeof formatNumber>[0], precise = false): string =>
    formatNumber(v, st.settings.notation, precise);

  const groups: [title: string, rows: Row[]][] = [
    [
      s.run,
      [
        [s.yawns, (st) => num(st, st.yawns)],
        [s.totalYawns, (st) => num(st, st.totalYawns)],
        [s.rate, (st) => num(st, totalRate(st), true)],
        [s.clickValue, (st) => num(st, clickValue(st), true)],
        [s.clicks, (st) => st.clicks.toLocaleString('ja-JP')],
        [s.playTime, (st) => formatDuration(st.playTimeMs / 1000)],
        [s.owned, (st) => totalOwned(st).toLocaleString('ja-JP')],
        [s.upgrades, (st) => t(s.count, { n: st.upgrades.size, total: UPGRADES.length })],
      ],
    ],
    [
      s.lifetime,
      [
        [s.totalYawns, (st) => num(st, st.lifetime.yawns)],
        [s.clicks, (st) => st.lifetime.clicks.toLocaleString('ja-JP')],
        [s.playTime, (st) => formatDuration(st.lifetime.playTimeMs / 1000)],
      ],
    ],
    [
      s.other,
      [
        [s.achievements, (st) => t(s.count, { n: st.achievements.size, total: ACHIEVEMENTS.length })],
        [
          s.achievementBonus,
          (st) => t(s.percent, { p: Math.round(st.achievements.size * (ACHIEVEMENT_BONUS + extraAchievementBonus(st)) * 100) }),
        ],
        [s.prestigeCount, (st) => st.prestige.count.toLocaleString('ja-JP')],
        [s.hibernationCount, (st) => `${st.hibernation.count} 回 ・ ${st.hibernation.warmthLifetime}`],
        [s.season, (st) => {
          const now = currentSeason(st);
          return now ? `${seasonLabel(now)}（${ja.hibernation.seasons[now].rule}）` : '—';
        }],
        [
          s.shards,
          (st) => `${st.prestige.shards.toLocaleString('ja-JP')} / ${st.prestige.shardsLifetime.toLocaleString('ja-JP')}`,
        ],
        [s.dreamBonus, (st) => `×${num(st, new Decimal(dreamProductionMultiplier(st)), true)}`],
        [s.encore, (st) => t(s.encoreValue, { n: st.prestige.encore })],
        [s.lottery, (st) => `${st.minigames.lottery.plays.toLocaleString('ja-JP')} / ${st.minigames.lottery.jackpots.toLocaleString('ja-JP')}`],
        [s.awakened, (st) => (st.awakenedAt === null ? '—' : new Date(st.awakenedAt).toLocaleDateString('ja-JP'))],
        [s.startedAt, (st) => new Date(st.createdAt).toLocaleDateString('ja-JP')],
        [s.dataStatus, (st) => (st.tainted ? `⚠ ${ja.taintedBadge}` : s.dataOk)],
      ],
    ],
  ];

  const cells: { dd: HTMLElement; value: Row[1] }[] = [];
  for (const [title, rows] of groups) {
    const dl = el('dl', 'stats-list');
    for (const [label, value] of rows) {
      const dd = el('dd');
      dl.append(el('dt', '', label), dd);
      cells.push({ dd, value });
    }
    root.append(el('h3', '', title), dl);
  }

  return {
    root,
    render(state) {
      for (const { dd, value } of cells) setText(dd, value(state));
      root.classList.toggle('is-tainted', state.tainted);
    },
  };
}
