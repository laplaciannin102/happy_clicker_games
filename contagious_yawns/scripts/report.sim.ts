import { it } from 'vitest';
import { formatReport, runBot } from './simulate';

declare const process: { stdout: { write(text: string): void }; env: Record<string, string | undefined> };

/**
 * `npm run simulate` で実行する。結果は BALANCE.md に貼る。
 * Vitest を実行環境として借りているだけなので、ここではアサーションしない（目標の確認は tests/balance.test.ts）。
 */
it('balance report', { timeout: 30 * 60_000 }, () => {
  // SIM_HOURS で長さを変えられる（例：SIM_HOURS=2 npm run simulate）
  const hours = Number(process.env.SIM_HOURS ?? 6);
  const scenarios = [
    { title: `能動プレイ（5クリック/秒・流れ星を拾う・${hours}時間）`, clicksPerSec: 5, watchStars: true },
    { title: `ゆったりプレイ（1クリック/秒・流れ星は拾わない・${hours}時間）`, clicksPerSec: 1, watchStars: false },
  ];
  for (const sc of scenarios) {
    const r = runBot({
      seconds: hours * 3600,
      clicksPerSec: sc.clicksPerSec,
      watchStars: sc.watchStars,
      prestige: { minShards: 10, growth: 0.5 },
      hibernate: true,
      dt: 0.5,
      // 2つのシナリオで合わせて 25分以内に終わるように
      maxWallMs: 12 * 60_000,
    });
    process.stdout.write(`\n${formatReport(sc.title, r)}\n`);
  }
});
