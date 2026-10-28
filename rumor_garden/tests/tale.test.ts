import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { createState } from '../src/state/game';
import { startTale, continueTale, bankTale, taleCost } from '../src/minigames/tale/game';
import { unlockTale, finishTale } from '../src/minigames/tale/clock';
import { advance, clickGain, production, temporaryMultiplier } from '../src/systems/economy';
import { grantAchievements } from '../src/systems/achievements';
import { catchUp } from '../src/core/time';
import { encode, decode, serialize, encodeSnapshot, inspect } from '../src/save/codec';
import { compress } from '../src/save/compression';
import { signature, toBase64Url } from '../src/save/crypto';
import { inconsistent } from '../src/save/validation';
import { openSave, type StoragePort } from '../src/save/storage';
import { createSaveActions } from '../src/save/actions';
import { createPrestigeState } from '../src/systems/prestige';
import { prestigeBalance } from '../src/data/prestige';
import { cloneTale } from '../src/minigames/tale/state';

const now = 1_800_000_000_000;
function ready() {
  const state = createState(now);
  state.earned = state.lifetimeEarned = new Decimal(100000);
  state.currency = new Decimal(99990); state.owned[0] = 1;
  state.clicks = state.runClicks = 100000; state.playSeconds = state.runSeconds = 1000;
  state.seed = 20261028; grantAchievements(state); unlockTale(state);
  return state;
}
function memory() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); } };
}
function successful(choice: 'safe' | 'bold' = 'safe') {
  const state = ready(); expect(startTale(state, choice)).toBe(true);
  state.tale.round!.rolls = [0, 0, 0]; return state;
}

describe('話のつぎほの経済と進行', () => {
  it('条件未達・費用不足・券不足・重複開始を拒否し、開始で費用と券だけを一度消費する', () => {
    expect(startTale(createState(now), 'safe')).toBe(false);
    const state = ready(), balance = state.currency, earned = state.earned, seed = state.seed;
    state.currency = new Decimal(999); expect(startTale(state, 'safe')).toBe(false);
    state.currency = balance; state.tale.tickets = 0; expect(startTale(state, 'safe')).toBe(false);
    state.tale.tickets = 3;
    const price = taleCost(state); expect(startTale(state, 'safe')).toBe(true);
    expect(state.currency.eq(balance.sub(price))).toBe(true); expect(state.earned.eq(earned)).toBe(true);
    expect(state.tale.tickets).toBe(2); expect(state.tale.spent.eq(price)).toBe(true);
    expect(state.seed).not.toBe(seed); expect(state.tale.round!.rolls).toHaveLength(3);
    expect(startTale(state, 'bold')).toBe(false); expect(inconsistent(state, now)).toBe(false);
  });
  it('費用は一時ブーストに影響されず、生産10秒分と1,000の大きい方になる', () => {
    const state = ready(); state.owned[0] = 10000;
    const price = taleCost(state); expect(price.eq(production(state, false).mul(10))).toBe(true);
    state.events.boost = 30; state.tale.boost = 60;
    expect(taleCost(state).eq(price)).toBe(true);
  });
  it('10秒前は選択不可、成功後は長時間経過しても選択待ちで、持ち帰りは一度だけ', () => {
    const state = successful(); advance(state, 9.95);
    expect(bankTale(state)).toBe(false); expect(continueTale(state, 'bold')).toBe(false);
    advance(state, 0.05); expect(state.tale.round!.phase).toBe('decision');
    advance(state, 600); expect(state.tale.round!.stage).toBe(0);
    expect(bankTale(state)).toBe(true); expect(state.tale.lastPoints).toBe(1); expect(state.tale.boost).toBe(10);
    expect(bankTale(state)).toBe(false); expect(state.tale.wins).toBe(1);
  });
  it('失敗は今回の全ポイントを失い、返金も報酬もない', () => {
    const state = successful('bold'); advance(state, 10); continueTale(state, 'safe');
    state.tale.round!.rolls[1] = 0.9;
    const before = state.currency, rate = production(state); advance(state, 10);
    expect(state.currency.sub(before).div(rate).toNumber()).toBeCloseTo(10);
    expect(state.tale.round).toBeNull(); expect(state.tale.lastOutcome).toBe('failure');
    expect(state.tale.lastPoints).toBe(0); expect(state.tale.boost).toBe(0);
  });
  it('成功判定は確率境界未満。大胆3回で自動終了し、6ポイント・挿絵1枚・60秒が上限', () => {
    for (const [choice, threshold] of [['safe', 0.9], ['bold', 0.6]] as const) {
      const state = successful(choice); state.tale.round!.rolls[0] = threshold; advance(state, 10);
      expect(state.tale.lastOutcome).toBe('failure');
    }
    const state = successful('bold');
    for (let i = 0; i < 3; i++) { advance(state, 10); if (i < 2) continueTale(state, 'bold'); }
    expect(state.tale.round).toBeNull(); expect(state.tale.boost).toBe(60);
    expect(state.tale.bestPoints).toBe(6); expect(state.tale.illustration).toBe(true);
    expect(continueTale(state, 'safe')).toBe(false); expect(finishTale(state, 6)).toBe(false);
    expect(inconsistent(state, now)).toBe(false);
  });
  it('同種の報酬は時間加算せず、イベントとの直接生産は6倍、クリックにはつぎほ倍率を付けない', () => {
    const state = successful(), base = production(state, false), click = clickGain(state);
    advance(state, 10); state.tale.boost = 50; bankTale(state);
    expect(state.tale.boost).toBe(50); expect(production(state).div(base).toNumber()).toBeCloseTo(2);
    expect(clickGain(state).eq(click)).toBe(true);
    state.events.boost = 30; expect(temporaryMultiplier(state).eq(6)).toBe(true);
    expect(production(state).div(base).toNumber()).toBeCloseTo(6);
    const expected = base.mul(6 * 30 + 2 * 20 + 10);
    expect(advance(state, 60).div(expected).toNumber()).toBeCloseTo(1);
  });
  it('券は15分に1枚で上限3枚。満タン中の経過を貯金せず、オフラインでも回復する', () => {
    const state = ready(); advance(state, 1000); startTale(state, 'safe');
    advance(state, 899); expect(state.tale.tickets).toBe(2);
    advance(state, 1); expect(state.tale.tickets).toBe(3); expect(state.tale.recharge).toBe(0);
    bankTale(state); startTale(state, 'safe');
    catchUp(state, now + 16 * 3600000);
    expect(state.tale.tickets).toBe(3); expect(state.lastOffline.capped).toBe(true);
    expect(state.tale.boost).toBe(0);
  });
  it('オンライン分割とオフライン一括で段階終了・報酬失効・生産量が一致する', () => {
    const whole = successful('bold'); advance(whole, 10); continueTale(whole, 'bold');
    advance(whole, 10); continueTale(whole, 'bold');
    const split = { ...whole, tale: cloneTale(whole.tale), events: { ...whole.events },
      records: { ...whole.records, maxOwned: [...whole.records.maxOwned] }, achievements: [...whole.achievements] };
    const before = whole.currency; const gained = catchUp(whole, now + 120000);
    for (let i = 0; i < 2400; i++) advance(split, 0.05);
    expect(whole.currency.sub(before).div(gained).toNumber()).toBeCloseTo(1);
    expect(split.currency.div(whole.currency).toNumber()).toBeCloseTo(1, 9);
    expect(split.tale.round).toBeNull(); expect(split.tale.boost).toBe(0);
    expect(whole.tale.lastPoints).toBe(6);
  });
});

describe('つぎほの保存と転生', () => {
  it('進行中と選択待ちを往復し、乱数・選択・成否が再読み込みでも同じになる', async () => {
    const state = successful(); const rolls = [...state.tale.round!.rolls]; advance(state, 4);
    const loaded = await decode(await encode(state), now);
    expect(loaded.tainted).toBe(false); expect(loaded.tale.round!.remaining).toBe(6);
    advance(state, 6); advance(loaded, 6);
    expect(serialize(loaded)).toBe(serialize(state));
    const waiting = await decode(await encode(loaded), now); catchUp(waiting, now + 3600000);
    expect(waiting.tale.round!.rolls).toEqual(rolls); expect(waiting.tale.round!.phase).toBe('decision');
    expect(waiting.tale.round!.stage).toBe(0);
  });
  it('開始は保存成功後に反映し、同時操作でも二重消費しない', async () => {
    const storage = memory(), session = await openSave(storage, now); await session.replace(ready());
    const actions = createSaveActions(session, { synchronize() {}, changed() {}, notify() {}, confirm: () => true });
    await Promise.all([actions.tale('start', 'safe'), actions.tale('start', 'bold')]);
    expect(session.state.tale.plays).toBe(1); expect(session.state.tale.tickets).toBe(2);
    const restored = await openSave(storage, now);
    expect(restored.state.tale.round!.rolls).toEqual(session.state.tale.round!.rolls);
    expect(restored.state.tainted).toBe(false);
  });
  it('保存失敗時は費用・券・乱数・進行を消費しない', async () => {
    const storage = memory(); let full = false;
    const port: StoragePort = { ...storage, setItem(key, value) { if (full) throw new Error('full'); storage.setItem(key, value); } };
    const session = await openSave(port, now); await session.replace(ready()); const before = serialize(session.state);
    const actions = createSaveActions(session, { synchronize() {}, changed() {}, notify() {}, confirm: () => true });
    full = true; await actions.tale('start', 'bold'); expect(serialize(session.state)).toBe(before);
  });
  it('署名付きv4を現行形式へ移行し、過去に解放済みなら券3枚から始める', async () => {
    const source = ready(), data = JSON.parse(serialize(source)) as Record<string, unknown>;
    for (const key of ['tale', 'generated', 'lastOfflineGenerated', 'myth', 'challenge', 'automation', 'preferences', 'mail']) delete data[key]; data.version = 4;
    const message = `rumor|v4|${toBase64Url(await compress(JSON.stringify(data)))}`;
    const loaded = await inspect(`${message}|${toBase64Url(await signature(message))}`, now);
    expect(loaded.signatureValid).toBe(true); expect(loaded.state.tainted).toBe(false);
    expect(loaded.state.tale.tickets).toBe(3); expect(loaded.state.currency.eq(source.currency)).toBe(true);
    expect(loaded.state.tale.spent.eq(0)).toBe(true);
  });
  it('破損した乱数・段階・時間・未知フィールドは拒否し、統計や支出の矛盾に改造印を付ける', async () => {
    const source = successful();
    for (const patch of [{ rolls: [0, 1, 0] }, { stage: 3 }, { remaining: 0 }, { unknown: true }]) {
      const data = JSON.parse(serialize(source)) as Record<string, unknown>;
      data.tale = { ...source.tale, spent: source.tale.spent.toString(), round: { ...source.tale.round, ...patch } };
      await expect(decode(await encodeSnapshot(JSON.stringify(data)), now)).rejects.toThrow();
    }
    for (const patch of [{ wins: 99 }, { illustration: true }, { spent: '10000000000' }]) {
      const data = JSON.parse(serialize(source)) as Record<string, unknown>;
      data.tale = { ...source.tale, spent: source.tale.spent.toString(), ...patch };
      expect((await decode(await encodeSnapshot(JSON.stringify(data)), now)).tainted).toBe(true);
    }
  });
  it('転生は券・回復・図鑑・生涯成績を保持し、話・一時倍率・今回の支出をリセットする', () => {
    const state = successful('bold');
    for (let i = 0; i < 3; i++) { advance(state, 10); if (i < 2) continueTale(state, 'bold'); }
    startTale(state, 'safe'); state.earned = prestigeBalance.requirement; state.lifetimeEarned = state.earned;
    grantAchievements(state);
    const next = createPrestigeState(state, now)!;
    expect(next.tale.tickets).toBe(state.tale.tickets); expect(next.tale.recharge).toBe(state.tale.recharge);
    expect(next.tale.illustration).toBe(true); expect(next.tale.plays).toBe(2);
    expect(next.tale.boost).toBe(0); expect(next.tale.round).toBeNull(); expect(next.tale.spent.eq(0)).toBe(true);
    expect(inconsistent(next, now)).toBe(false);
  });
});
