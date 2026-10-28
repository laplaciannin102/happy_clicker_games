import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { OFFLINE } from '../src/data/economy';
import { STARS, STAR_EFFECTS, type StarEffectId } from '../src/data/stars';
import { decodeSave, encodeSave } from '../src/save/codec';
import { checkIntegrity } from '../src/save/integrity';
import { createInitialState, type GameState } from '../src/state/gameState';
import { buffMultiplier, tickBuffs } from '../src/systems/buffs';
import { clickValue } from '../src/systems/click';
import { applyOffline } from '../src/systems/offline';
import { totalRate } from '../src/systems/production';
import { pickWeighted } from '../src/systems/random';
import { catchStar, tickStars } from '../src/systems/stars';
import { playedState } from './helpers';

const strict = { allowLegacyJson: false };

function withProducers(seed = 1): GameState {
  const s = createInitialState(0, seed);
  s.producers.meeting.bought = 10; // 毎秒 90
  return s;
}

/** 次の流れ星が出るまで時間を進める */
function spawn(s: GameState): void {
  tickStars(s, s.stars.timerMs, true);
}

describe('流れ星の出現', () => {
  it('最初は firstIntervalMs 後。画面が見えていないと進まない', () => {
    const s = withProducers();
    tickStars(s, STARS.firstIntervalMs, false);
    expect(s.stars.active).toBeNull();
    tickStars(s, STARS.firstIntervalMs - 1, true);
    expect(s.stars.active).toBeNull();
    tickStars(s, 1, true);
    expect(s.stars.active).not.toBeNull();
  });

  it('次の間隔は min〜max の範囲、出ているあいだは次の時間が止まる', () => {
    const s = withProducers();
    spawn(s);
    const next = s.stars.timerMs;
    expect(next).toBeGreaterThanOrEqual(STARS.minIntervalMs);
    expect(next).toBeLessThan(STARS.maxIntervalMs);
    tickStars(s, 5_000, true);
    expect(s.stars.timerMs).toBe(next);
  });

  it('拾わなければ visibleMs で消える', () => {
    const s = withProducers();
    spawn(s);
    tickStars(s, STARS.visibleMs, true);
    expect(s.stars.active).toBeNull();
  });

  it('効果・位置はシードで決まり、セーブして読み直しても変わらない', async () => {
    const a = withProducers(42);
    const b = withProducers(42);
    spawn(a);
    spawn(b);
    expect(a.stars.active).toEqual(b.stars.active);

    const back = await decodeSave(await encodeSave(a), strict);
    expect(back.ok && back.value.state.stars.active).toEqual(a.stars.active);
    expect(back.ok && back.value.state.rngSeed).toBe(a.rngSeed);
  });

  it('重みつき抽選は重みどおりに近い割合になる', () => {
    const s = createInitialState(0, 7);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 10_000; i++) {
      const id = pickWeighted(s, STAR_EFFECTS).id;
      counts[id] = (counts[id] ?? 0) + 1;
    }
    const total = STAR_EFFECTS.reduce((sum, e) => sum + e.weight, 0);
    for (const e of STAR_EFFECTS) expect((counts[e.id] ?? 0) / 10_000).toBeCloseTo(e.weight / total, 1);
  });
});

describe('流れ星の効果', () => {
  function caughtWith(effect: StarEffectId): GameState {
    const s = withProducers();
    s.yawns = new Decimal(1e6);
    s.stars.active = { effect, x: 0.5, y: 0.5, remainingMs: 1000 };
    return s;
  }

  it('ねがいごと：60秒間 生産 ×7、時間がたつと消える', () => {
    const s = caughtWith('wish');
    const before = totalRate(s).toNumber();
    expect(catchStar(s)?.effect).toBe('wish');
    expect(totalRate(s).toNumber()).toBeCloseTo(before * 7);
    tickBuffs(s, 60_000);
    expect(totalRate(s).toNumber()).toBeCloseTo(before);
    expect(s.stars.clicked).toBe(1);
    expect(s.lifetime.stars).toBe(1);
  });

  it('大あくび：クリック ×77', () => {
    const s = caughtWith('big_yawn');
    catchStar(s);
    expect(clickValue(s).toNumber()).toBe(77);
  });

  it('ひとやすみ：生産15分ぶん、ただし手持ちの15%まで', () => {
    const s = caughtWith('rest');
    const result = catchStar(s);
    expect(result?.gained?.toNumber()).toBeCloseTo(Math.min(90 * 900, 1e6 * 0.15));
  });

  it('同じ効果を続けて拾っても重ならず、時間が延びる', () => {
    const s = caughtWith('wish');
    catchStar(s);
    tickBuffs(s, 30_000);
    s.stars.active = { effect: 'wish', x: 0.5, y: 0.5, remainingMs: 1000 };
    catchStar(s);
    expect(s.buffs).toHaveLength(1);
    expect(buffMultiplier(s, 'production')).toBe(7);
    expect(s.buffs[0]?.remainingMs).toBe(60_000);
  });

  it('出ていないときは拾えない', () => {
    expect(catchStar(withProducers())).toBeNull();
  });
});

describe('オフライン進行', () => {
  it('効率 50%、プレイ時間にも数える', () => {
    const s = withProducers();
    const r = applyOffline(s, 60 * 60_000);
    expect(r.gained.toNumber()).toBeCloseTo(90 * 3600 * OFFLINE.efficiency);
    expect(s.yawns.toNumber()).toBeCloseTo(r.gained.toNumber());
    expect(s.playTimeMs).toBe(60 * 60_000);
    expect(r.capped).toBe(false);
  });

  it('上限は8時間、時計が戻っていたら 0', () => {
    const s = withProducers();
    const r = applyOffline(s, 24 * 60 * 60_000);
    expect(r.countedMs).toBe(OFFLINE.capMs);
    expect(r.capped).toBe(true);
    expect(applyOffline(withProducers(), -5_000).gained.toNumber()).toBe(0);
    expect(applyOffline(withProducers(), Number.NaN).gained.toNumber()).toBe(0);
  });

  it('一時的な倍率はオフラインの生産に効かず、時間だけ進む', () => {
    const s = withProducers();
    s.buffs.push({ kind: 'production', factor: 7, remainingMs: 60_000, source: 'wish' });
    const r = applyOffline(s, 10 * 60_000);
    expect(r.gained.toNumber()).toBeCloseTo(90 * 600 * OFFLINE.efficiency);
    expect(s.buffs).toEqual([]);
  });
});

describe('整合性チェック（流れ星込み）', () => {
  it('流れ星で稼いだぶんは「多すぎる」と判定しない', () => {
    const s = playedState();
    s.stars.clicked = 2;
    s.lifetime.stars = 2;
    // 2個ぶんの「ひとやすみ」程度を上乗せ
    const extra = totalRate(s).mul(900 * 2);
    s.totalYawns = s.totalYawns.add(extra);
    s.lifetime.yawns = s.totalYawns;
    expect(checkIntegrity(s, 1_800_000_000_000)).not.toContain('earnedTooFast');
  });

  it('プレイ時間に対して流れ星が多すぎれば検出', () => {
    const s = playedState();
    s.stars.clicked = 50;
    s.lifetime.stars = 50;
    expect(checkIntegrity(s, 1_800_000_000_000)).toContain('starsTooFrequent');
  });
});
