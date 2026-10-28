import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { PILLOWS, SHEEP_GAME } from '../src/data/minigames';
import { STARS } from '../src/data/stars';
import { sheepGame } from '../src/minigames/sheep';
import { generateSheep, isCountable, judge, rewardFactor, score } from '../src/minigames/sheep/logic';
import { decodeSave, encodeSave } from '../src/save/codec';
import { checkIntegrity } from '../src/save/integrity';
import { migrate } from '../src/save/migrations';
import { createInitialState, type GameState } from '../src/state/gameState';
import { applyOffline } from '../src/systems/offline';
import { addPillow, sheepUnlocked, tickPillows } from '../src/systems/pillows';
import { rateEach } from '../src/systems/production';
import { catchStar, tickStars } from '../src/systems/stars';
import { playedState } from './helpers';

/** 遊べる状態（おやすみ1回・あくびたっぷり） */
function playable(seed = 1): GameState {
  const s = createInitialState(0, seed);
  s.prestige.count = 1;
  s.yawns = new Decimal(1e6);
  s.totalYawns = s.yawns;
  return s;
}

describe('羊の並び', () => {
  it('同じシードなら同じ並び、違うシードなら違う並び', () => {
    expect(generateSheep(123)).toEqual(generateSheep(123));
    expect(generateSheep(123)).not.toEqual(generateSheep(124));
  });

  it('時間内に収まり、間隔は minGapMs 以上で、判定の幅が重ならない', () => {
    for (const seed of [1, 2, 3, 99, 4242]) {
      const sheep = generateSheep(seed);
      expect(sheep.length).toBeGreaterThan(15);
      expect(sheep[0]?.atMs).toBe(SHEEP_GAME.firstAtMs);
      for (let i = 1; i < sheep.length; i++) {
        const gap = (sheep[i]?.atMs ?? 0) - (sheep[i - 1]?.atMs ?? 0);
        expect(gap).toBeGreaterThanOrEqual(SHEEP_GAME.minGapMs - 1);
        expect(gap).toBeGreaterThan(SHEEP_GAME.windowMs * 2);
      }
      expect(sheep.at(-1)?.atMs ?? Infinity).toBeLessThanOrEqual(SHEEP_GAME.durationMs - SHEEP_GAME.tailMs);
    }
  });

  it('めずらしい羊には種類がつく', () => {
    const all = Array.from({ length: 200 }, (_, i) => generateSheep(i)).flat();
    const rares = all.filter((s) => s.kind === 'rare');
    expect(rares.length).toBeGreaterThan(0);
    expect(rares.every((s) => s.rare !== undefined)).toBe(true);
  });
});

describe('判定', () => {
  const sheep = generateSheep(7);
  const countable = sheep.filter(isCountable);

  it('数えてよい羊をちょうどの時刻に押せば満点', () => {
    const r = judge(sheep, countable.map((s) => s.atMs));
    expect(r.counted).toBe(countable.length);
    expect(r.mistakes).toBe(0);
  });

  it('判定の幅の端でも数えられ、外れたら数え間違い', () => {
    const first = countable[0]!;
    expect(judge(sheep, [first.atMs + SHEEP_GAME.windowMs]).counted).toBe(1);
    expect(judge(sheep, [first.atMs + SHEEP_GAME.windowMs + 1]).mistakes).toBe(1);
  });

  it('黒い羊・跳ぶふりの羊・何もいないときは数え間違い', () => {
    const black = { kind: 'black' as const, atMs: 1000 };
    const feint = { kind: 'feint' as const, atMs: 3000 };
    const r = judge([black, feint], [1000, 3000, 5000]);
    expect(r).toMatchObject({ counted: 0, mistakes: 3, blackCounted: 1 });
  });

  it('同じ羊は1回しか数えない', () => {
    const one = { kind: 'normal' as const, atMs: 1000 };
    expect(judge([one], [990, 1010])).toMatchObject({ counted: 1, mistakes: 1 });
  });

  it('連打しても得をしない（50ミリ秒ごとに押し続けるとスコア 0）', () => {
    const presses = Array.from({ length: SHEEP_GAME.durationMs / 50 }, (_, i) => i * 50);
    expect(score(judge(sheep, presses))).toBe(0);
  });

  it('報酬の倍率には上限がある', () => {
    expect(rewardFactor(0)).toBe(1);
    expect(rewardFactor(10)).toBeCloseTo(2);
    expect(rewardFactor(1000)).toBe(SHEEP_GAME.maxFactor);
  });
});

describe('遊ぶ（共通インターフェース）', () => {
  it('おやすみ前・羊なしでは遊べない', () => {
    const s = createInitialState(0, 1);
    s.yawns = new Decimal(1e6);
    expect(sheepGame.unlockCondition(s)).toBe(false);
    expect(sheepGame.start(s)).toBeNull();
    s.producers.sheep.bought = 1;
    expect(sheepGame.unlockCondition(s)).toBe(true);
  });

  it('費用：まくら1つ ＋ 生産3分ぶん（最低100）', () => {
    const s = playable();
    expect(sheepGame.cost(s).yawns.toNumber()).toBe(SHEEP_GAME.costMin);
    s.producers.meeting.bought = 10;
    const rate = rateEach(s, 'meeting').toNumber() * 10;
    expect(sheepGame.cost(s).yawns.toNumber()).toBe(Math.floor(rate * SHEEP_GAME.costSeconds));
  });

  it('始めると費用を払い、遊ぶ回を覚える。払えなければ何も変わらない', () => {
    const s = playable();
    const session = sheepGame.start(s);
    expect(session).not.toBeNull();
    expect(s.minigames.pillows).toBe(PILLOWS.max - 1);
    expect(s.yawns.toNumber()).toBe(1e6 - SHEEP_GAME.costMin);
    expect(s.minigames.active).toEqual({ seed: session?.seed });

    const poor = playable();
    poor.yawns = new Decimal(10);
    expect(sheepGame.start(poor)).toBeNull();
    expect(poor.minigames.pillows).toBe(PILLOWS.max);
  });

  it('同じ状態から始めれば同じ羊の並び（結果を見てからロードし直しても変わらない）', async () => {
    const s = playable(42);
    const text = await encodeSave(s);
    const a = sheepGame.start(s);
    const back = await decodeSave(text, { allowLegacyJson: false });
    if (!back.ok) throw new Error('decode failed');
    const b = sheepGame.start(back.value.state);
    expect(b?.sheep).toEqual(a?.sheep);
  });

  it('終わると、クリック倍率・回数・自己ベスト・図鑑が更新される', () => {
    const s = playable();
    const session = sheepGame.start(s)!;
    session.sheep[0] = { kind: 'rare', atMs: session.sheep[0]!.atMs, rare: 'gold' };
    const presses = session.sheep.filter(isCountable).map((x) => x.atMs);
    const reward = sheepGame.onFinish(s, session, presses);
    expect(reward.points).toBe(presses.length);
    expect(reward.factor).toBeGreaterThan(1);
    expect(reward.best).toBe(true);
    // 並びによってはほかのめずらしい羊もいる
    expect(reward.newRares).toContain('gold');
    expect(s.buffs).toEqual([{ kind: 'click', factor: reward.factor, remainingMs: SHEEP_GAME.buffMs, source: 'sheep' }]);
    expect(s.minigames).toMatchObject({ sheepPlays: 1, sheepRunPlays: 1, sheepBest: presses.length, active: null });
    expect([...s.minigames.collection].sort()).toEqual([...reward.newRares].sort());
    // 図鑑1種類につき全生産 +2%
    s.producers.cat.bought = 1;
    const found = s.minigames.collection.size;
    const withBonus = rateEach(s, 'cat').toNumber();
    s.minigames.collection.clear();
    expect(withBonus).toBeCloseTo(rateEach(s, 'cat').toNumber() * (1 + found * SHEEP_GAME.collectionBonus));
  });

  it('費用を払っていない回・2回目の終了では何も与えない', () => {
    const s = playable();
    const session = sheepGame.start(s)!;
    const presses = session.sheep.filter(isCountable).map((x) => x.atMs);
    sheepGame.onFinish(s, session, presses);
    const again = sheepGame.onFinish(s, session, presses);
    expect(again.factor).toBe(1);
    expect(s.minigames.sheepPlays).toBe(1);
  });

  it('ありえない時刻の押下は無視する', () => {
    const s = playable();
    const session = sheepGame.start(s)!;
    const reward = sheepGame.onFinish(s, session, [-5, Number.NaN, SHEEP_GAME.durationMs + 1]);
    expect(reward.result.mistakes).toBe(0);
  });
});

describe('まくら', () => {
  it('20分で1つ回復、満タンなら止まる', () => {
    const s = playable();
    s.minigames.pillows = 0;
    tickPillows(s, PILLOWS.regenMs - 1);
    expect(s.minigames.pillows).toBe(0);
    tickPillows(s, 1);
    expect(s.minigames.pillows).toBe(1);
    tickPillows(s, PILLOWS.regenMs * 10);
    expect(s.minigames.pillows).toBe(PILLOWS.max);
    expect(s.minigames.pillowTimerMs).toBe(PILLOWS.regenMs);
  });

  it('オフラインでも回復する', () => {
    const s = playable();
    s.minigames.pillows = 0;
    applyOffline(s, PILLOWS.regenMs * 2 + 1);
    expect(s.minigames.pillows).toBe(2);
  });

  it('流れ星「羊が迷い込む」でまくら +1（満タンなら増えない）。解放前は出ない', () => {
    const s = playable();
    s.minigames.pillows = 1;
    s.stars.active = { effect: 'stray_sheep', x: 0.5, y: 0.5, remainingMs: 1000 };
    expect(catchStar(s)?.pillow).toBe(true);
    expect(s.minigames.pillows).toBe(2);
    expect(addPillow(s)).toBe(true);
    expect(addPillow(s)).toBe(false);

    const locked = createInitialState(0, 5);
    expect(sheepUnlocked(locked)).toBe(false);
    for (let i = 0; i < 300; i++) {
      tickStars(locked, STARS.maxIntervalMs, true);
      expect(locked.stars.active?.effect).not.toBe('stray_sheep');
      locked.stars.active = null;
    }
  });
});

describe('セーブと整合性チェック', () => {
  it('ミニゲームの状態は往復で保たれる', async () => {
    const s = playable();
    s.minigames.collection.add('moon');
    s.minigames.sheepBest = 12;
    s.buffs.push({ kind: 'click', factor: 2.2, remainingMs: 5000, source: 'sheep' });
    const back = await decodeSave(await encodeSave(s), { allowLegacyJson: false });
    expect(back.ok && back.value.state.minigames).toEqual(s.minigames);
    expect(back.ok && back.value.state.buffs).toEqual(s.buffs);
  });

  it('v6 → v7：まくら満タンで始まる', () => {
    expect(migrate({ prestige: {} }, 6)).toMatchObject({ minigames: { pillows: PILLOWS.max, collection: [], active: null } });
  });

  it('羊を数えた回数が、まくらの回復より多いと検出', () => {
    const s = playedState();
    s.minigames.sheepPlays = 3;
    s.minigames.sheepRunPlays = 3;
    expect(checkIntegrity(s, Date.now())).not.toContain('sheepTooFrequent');
    s.minigames.sheepPlays = 100;
    expect(checkIntegrity(s, Date.now())).toContain('sheepTooFrequent');
  });
});
