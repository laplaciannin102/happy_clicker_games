import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { LOTTERY, LOTTERY_CONSOLATION, LOTTERY_REWARDS, LOTTERY_SYMBOLS } from '../src/data/lottery';
import { PILLOWS } from '../src/data/minigames';
import { currentDraw, lotteryGame, lotteryUnlocked, respinLottery } from '../src/minigames/lottery';
import { evaluate, reelsFor, sanitizeHolds } from '../src/minigames/lottery/logic';
import { decodeSave, encodeSave } from '../src/save/codec';
import { checkIntegrity } from '../src/save/integrity';
import { migrate } from '../src/save/migrations';
import { createInitialState, type GameState } from '../src/state/gameState';
import { doPrestige } from '../src/systems/prestige';
import { totalRate } from '../src/systems/production';
import { playedState } from './helpers';

/** 夢くじを引ける状態（おやすみ3回・券1枚・猫がいて生産あり） */
function playable(seed = 1): GameState {
  const s = createInitialState(0, seed);
  s.prestige.count = LOTTERY.unlockPrestiges;
  s.minigames.lottery.tickets = 1;
  s.producers.cat.bought = 10;
  return s;
}

describe('出目と判定', () => {
  it('同じシード・同じ残し方なら同じ出目。回し直しで残したリールは変わらない', () => {
    expect(reelsFor(42, [])).toEqual(reelsFor(42, []));
    const first = reelsFor(42, []);
    const held = [true, false, true];
    const after = reelsFor(42, [held]);
    expect(after[0]).toBe(first[0]);
    expect(after[2]).toBe(first[2]);
    expect(reelsFor(42, [held])).toEqual(after);
  });

  it('どの絵柄も出る（重みのとおりにだいたい出る）', () => {
    const counts = new Map<string, number>();
    for (let seed = 0; seed < 3000; seed++) for (const r of reelsFor(seed, [])) counts.set(r, (counts.get(r) ?? 0) + 1);
    const total = LOTTERY_SYMBOLS.reduce((sum, id) => sum + LOTTERY.weights[id], 0);
    for (const id of LOTTERY_SYMBOLS) {
      const expected = (9000 * LOTTERY.weights[id]) / total;
      expect(counts.get(id) ?? 0).toBeGreaterThan(expected * 0.85);
      expect(counts.get(id) ?? 0).toBeLessThan(expected * 1.15);
    }
  });

  it('3つ・2つ・ばらばらの判定', () => {
    expect(evaluate(['moon', 'moon', 'moon'])).toEqual({ symbol: 'moon', match: 3, reward: LOTTERY_REWARDS.moon.three });
    expect(evaluate(['star', 'cloud', 'star'])).toEqual({ symbol: 'star', match: 2, reward: LOTTERY_REWARDS.star.two });
    expect(evaluate(['sheep', 'cloud', 'futon'])).toEqual({ symbol: null, match: 0, reward: LOTTERY_CONSOLATION });
  });

  it('回し直しは2回まで。おかしな指定と全部残す指定は数えない', () => {
    expect(sanitizeHolds([[true], [false, false, false], [true, true, true], [false, true, false]])).toEqual([
      [true, false, false],
      [false, false, false],
    ]);
    expect(sanitizeHolds([['yes', 1, null]])).toEqual([[false, false, false]]);
  });
});

describe('夢くじを引く', () => {
  it('おやすみ3回で解放、券がないと引けない', () => {
    const s = playable();
    expect(lotteryUnlocked(s)).toBe(true);
    s.prestige.count = LOTTERY.unlockPrestiges - 1;
    expect(lotteryGame.start(s)).toBeNull();
    s.prestige.count = LOTTERY.unlockPrestiges;
    s.minigames.lottery.tickets = 0;
    expect(lotteryGame.start(s)).toBeNull();
  });

  it('券を払って引き、回し直して、決めると報酬が入る（途中は続きから）', () => {
    const s = playable();
    const session = lotteryGame.start(s);
    expect(session).not.toBeNull();
    expect(s.minigames.lottery.tickets).toBe(0);
    // 引いている途中は2回目を始められない
    s.minigames.lottery.tickets = 1;
    expect(lotteryGame.start(s)).toBeNull();
    expect(currentDraw(s)?.respinsLeft).toBe(LOTTERY.respins);
    expect(respinLottery(s, [true, false, false])).toBe(true);
    expect(respinLottery(s, [true, true, true])).toBe(false);
    expect(respinLottery(s, [false, false, true])).toBe(true);
    expect(respinLottery(s, [false, false, false])).toBe(false);
    const draw = currentDraw(s);
    expect(draw?.respinsLeft).toBe(0);
    const prize = session && lotteryGame.onFinish(s, session, s.minigames.lottery.active?.holds ?? []);
    expect(prize?.reels).toEqual(draw?.reels);
    expect(s.minigames.lottery.active).toBeNull();
    expect(s.minigames.lottery.plays).toBe(1);
    expect(s.minigames.lottery.runPlays).toBe(1);
    // 同じ回でもう一度受け取ることはできない
    expect(session && lotteryGame.onFinish(s, session, [])).toBeNull();
  });

  it('報酬：生産の倍率・あくび・まくら・流れ星・かけら', () => {
    // 3つそろう出目が出るシードを探して、それぞれの効果を確かめる
    const found = new Map<string, number>();
    for (let seed = 0; seed < 5000 && found.size < LOTTERY_SYMBOLS.length; seed++) {
      const r = evaluate(reelsFor(seed, []));
      if (r.match === 3 && r.symbol && !found.has(r.symbol)) found.set(r.symbol, seed);
    }
    expect(found.size).toBe(LOTTERY_SYMBOLS.length);
    const run = (symbol: string): GameState => {
      const s = playable();
      s.minigames.lottery.active = { seed: found.get(symbol) ?? 0, holds: [] };
      lotteryGame.onFinish(s, { seed: found.get(symbol) ?? 0 }, []);
      return s;
    };
    expect(run('moon').buffs).toMatchObject([{ kind: 'production', factor: 4, source: 'lottery' }]);
    expect(run('coffee').buffs).toMatchObject([{ kind: 'click', factor: 20, source: 'lottery' }]);
    const cloud = run('cloud');
    const rate = totalRate(cloud);
    expect(cloud.yawns.toNumber()).toBeCloseTo(rate.mul(3600).floor().toNumber());
    const sheep = playable();
    sheep.minigames.pillows = 0;
    sheep.minigames.lottery.active = { seed: found.get('sheep') ?? 0, holds: [] };
    expect(lotteryGame.onFinish(sheep, { seed: found.get('sheep') ?? 0 }, [])?.pillows).toBe(PILLOWS.max);
    expect(run('star').stars.timerMs).toBe(0);
    const futon = run('futon');
    expect(futon.prestige.shards).toBe(1);
    expect(futon.prestige.shardsLifetime).toBe(1);
    expect(futon.minigames.lottery.jackpots).toBe(1);
  });

  it('おやすみで券を1枚もらう（上限まで）', () => {
    const s = createInitialState(0, 1);
    for (let i = 0; i < 5; i++) {
      s.totalYawns = new Decimal(1e9);
      doPrestige(s);
    }
    expect(s.minigames.lottery.tickets).toBe(LOTTERY.ticketsMax);
  });
});

describe('セーブと整合性チェック', () => {
  it('引いている途中の回も往復で保たれる', async () => {
    const s = playedState();
    s.prestige.count = 5;
    s.minigames.lottery = { tickets: 1, plays: 2, runPlays: 1, jackpots: 1, active: { seed: 99, holds: [[true, false, false]] } };
    const back = await decodeSave(await encodeSave(s), { allowLegacyJson: false });
    expect(back.ok && back.value.state.minigames.lottery).toEqual(s.minigames.lottery);
  });

  it('v11 → v12：券はおやすみの回数ぶん（上限まで）、夢の続きとめざめが足される', () => {
    expect(migrate({ prestige: { count: 2 }, minigames: { pillows: 1 } }, 11)).toMatchObject({
      prestige: { count: 2, encore: 0 },
      minigames: { pillows: 1, lottery: { tickets: 2, plays: 0, runPlays: 0, jackpots: 0, active: null } },
      awakenedAt: null,
    });
    expect(migrate({ prestige: { count: 50 } }, 11)).toMatchObject({ minigames: { lottery: { tickets: LOTTERY.ticketsMax } } });
  });

  it('おやすみの回数より多く引いていたら検出', () => {
    const s = playedState();
    s.prestige.count = 2;
    s.minigames.lottery.plays = 2;
    expect(checkIntegrity(s, Date.now())).not.toContain('lotteryTooMany');
    s.minigames.lottery.tickets = 1;
    expect(checkIntegrity(s, Date.now())).toContain('lotteryTooMany');
  });

  it('夢くじで増えたあくびは、整合性チェックで改造と判定しない', () => {
    const s = playedState();
    s.prestige.count = 3;
    s.minigames.lottery.tickets = 0;
    s.minigames.lottery.plays = 1;
    s.minigames.lottery.runPlays = 1;
    const extra = totalRate(s).mul(3600);
    s.totalYawns = s.totalYawns.add(extra);
    s.yawns = s.yawns.add(extra);
    s.lifetime.yawns = s.lifetime.yawns.add(extra);
    expect(checkIntegrity(s, Date.now())).toEqual([]);
  });
});
