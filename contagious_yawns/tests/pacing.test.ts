import { describe, expect, it } from 'vitest';
import { runBot } from '../scripts/simulate';

/**
 * 序盤ペースと初回おやすみの目標（SPEC §4.1、DESIGN.md §12、BALANCE.md）。
 * 長いシミュレーションは npm run simulate で回す。ここでは初回おやすみまでを確かめる。
 */
describe('序盤ペース（能動プレイ：5クリック/秒・流れ星を拾う）', () => {
  const r = runBot({ seconds: 45 * 60, clicksPerSec: 5, watchStars: true, prestige: null, dt: 0.25 });

  it('最初の購入は 10 秒以内', () => {
    expect(r.firstBought.cat).toBeLessThanOrEqual(10);
  });

  it('1 分以内に 2 種類目が表示される（3 種類目の「???」予告も出る）', () => {
    expect(r.firstSeen.lecture).toBeLessThanOrEqual(60);
  });

  it('5 分以内に会議を買える', () => {
    expect(r.firstBought.meeting).toBeLessThanOrEqual(300);
  });

  it('初回のおやすみは 25〜45 分（目標 30〜60 分の早い側）', () => {
    expect(r.firstPrestigeReady).not.toBeNull();
    expect(r.firstPrestigeReady ?? 0).toBeGreaterThanOrEqual(25 * 60);
    expect(r.firstPrestigeReady ?? Infinity).toBeLessThanOrEqual(45 * 60);
  });
});
