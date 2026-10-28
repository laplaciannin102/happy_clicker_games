import { it } from 'vitest';
import { CHALLENGES } from '../src/data/challenges';
import { startChallenge } from '../src/systems/prestige';
import { cloneState, runBot } from './simulate';

declare const process: { stdout: { write(text: string): void } };

/**
 * チャレンジのクリアにかかる時間（npm run simulate に含まれる）。
 * 能動プレイのボットで1回目の冬眠まで進め、その状態から8種それぞれに挑戦する（挑戦中はおやすみしない）。
 */
it('challenge report', { timeout: 20 * 60_000 }, () => {
  const base = runBot({
    seconds: 12 * 3600,
    clicksPerSec: 5,
    watchStars: true,
    prestige: { minShards: 10, growth: 0.5 },
    hibernate: true,
    dt: 0.5,
    stopWhen: (s) => s.hibernation.count >= 1,
  });
  const at = base.stoppedAt ?? 0;
  const lines = [`### チャレンジ（能動プレイ・1回目の冬眠 ${(at / 3600).toFixed(1)}時間 の直後から、上限 3時間）`, '', '| チャレンジ | 目標 | 結果 |', '|---|---|---|'];
  for (const c of CHALLENGES) {
    const s = cloneState(base.state);
    startChallenge(s, c.id);
    const r = runBot({
      seconds: 3 * 3600,
      clicksPerSec: 5,
      watchStars: true,
      prestige: null,
      dt: 0.5,
      initial: s,
      maxWallMs: 60_000,
      stopWhen: (x) => x.challenges.active === null,
    });
    const done = r.state.challenges.completed.has(c.id);
    const t = r.stoppedAt === null ? '-' : `${(r.stoppedAt / 60).toFixed(1)}分`;
    lines.push(`| ${c.id} | ${c.goal.toExponential(0)} | ${done ? `クリア ${t}` : r.stoppedAt !== null ? `失敗 ${t}` : '3時間で届かず'} |`);
  }
  process.stdout.write(`\n${lines.join('\n')}\n`);
});
