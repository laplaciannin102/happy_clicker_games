import { it } from 'vitest';
import { CHALLENGES } from '../src/data/challenges';
import { runBot } from './simulate';

declare const process: { stdout: { write(text: string): void }; env: Record<string, string | undefined> };

/**
 * 終盤（めざめ）の目安（npm run simulate に含まれる）。能動プレイのボットで冬眠を続け、
 * 周回の累計あくびが 10ⁿ に初めて届いた時刻と、そのときの冬眠回数を記録する。
 * チャレンジはボットが挑まないので、1回目の冬眠のあと全部クリアした扱いにする（報酬込みの速さを見る）。
 */
it('endgame report', { timeout: 30 * 60_000 }, () => {
  const hours = Number(process.env.SIM_HOURS ?? 24);
  const reached = new Map<number, { sec: number; hibernations: number }>();
  let sec = 0;
  const r = runBot({
    seconds: hours * 3600,
    clicksPerSec: 5,
    watchStars: true,
    prestige: { minShards: 10, growth: 0.5 },
    hibernate: true,
    dt: 0.5,
    maxWallMs: 15 * 60_000,
    // stopWhen はゲーム内の1秒ごとに呼ばれるので、記録に使う
    stopWhen: (s) => {
      sec += 1;
      if (s.hibernation.count >= 1 && s.challenges.completed.size === 0) {
        for (const c of CHALLENGES) s.challenges.completed.add(c.id);
      }
      const e = Math.floor(s.totalYawns.log10().toNumber());
      for (let n = 20; n <= e; n += 5) if (!reached.has(n)) reached.set(n, { sec, hibernations: s.hibernation.count });
      return false;
    },
  });
  const lines = [`### 終盤（能動プレイ・${hours}時間、チャレンジは1回目の冬眠のあと全部クリア扱い）`, '', '| 周回の累計 | 初めて届いた時刻 | そのときの冬眠回数 |', '|---|---|---|'];
  for (const [n, v] of reached) lines.push(`| 1e${n} | ${(v.sec / 3600).toFixed(1)}時間 | ${v.hibernations} |`);
  lines.push('', `- 冬眠：${r.hibernations.map((h) => `${(h.at / 3600).toFixed(1)}h(+${h.warmth})`).join(' → ')}`);
  if (r.stoppedAt !== null) lines.push(`- ⚠ 実時間の上限で ${(r.stoppedAt / 3600).toFixed(1)}時間 の時点で止めた`);
  process.stdout.write(`\n${lines.join('\n')}\n`);
});
