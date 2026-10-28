import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { createState, type GameState } from '../src/state/game';
import { producers } from '../src/data/balance';
import { upgrades } from '../src/data/upgrades';
import { mythBalance } from '../src/data/myth';
import { prestigeBalance } from '../src/data/prestige';
import { chainEvolution } from '../src/systems/chain';
import { advance, buy, cost, production, clickGain, whisper, mythMultiplier } from '../src/systems/economy';
import { buyUpgrade } from '../src/systems/upgrades';
import { buyPermanentUpgrade, createPrestigeState } from '../src/systems/prestige';
import { grantAchievements } from '../src/systems/achievements';
import { compileMyth, startChallenge, leaveChallenge } from '../src/systems/myth';
import { automate, configureAutomation, shouldAutoPrestige } from '../src/systems/automation';
import { advanceWorld } from '../src/core/progression';
import { catchUp } from '../src/core/time';
import { decode, encode, encodeSnapshot, serialize, inspect } from '../src/save/codec';
import { signature, toBase64Url } from '../src/save/crypto';
import { compress } from '../src/save/compression';
import { inconsistent } from '../src/save/validation';
import { parseState } from '../src/save/state-format';
import { openSave, type StoragePort } from '../src/save/storage';
import { createSaveActions } from '../src/save/actions';

const now = 1_800_000_000_000;
function clone(state: GameState): GameState { return parseState(JSON.parse(serialize(state)) as unknown); }
function rich(myths = 0): GameState {
  const s = createState(now), initial = createState(now);
  s.owned.fill(50); s.earned = new Decimal('1e21'); s.lifetimeEarned = new Decimal('2e21');
  s.runSeconds = s.playSeconds = 1e8;
  s.prestige = { points: new Decimal(100), total: new Decimal(100), count: myths + 1, upgrades: [], lastGain: new Decimal(100) };
  s.myth = { count: myths, archivedPoints: new Decimal(myths * 100), archivedPrestiges: myths };
  s.upgrades = upgrades.filter(u => u.producer === null || u.requirement.lte(50)).map(u => u.id);
  let spent = new Decimal(0);
  producers.forEach((_, i) => { spent = spent.add(cost(initial, i, 50)); });
  upgrades.filter(u => s.upgrades.includes(u.id)).forEach(u => { spent = spent.add(u.cost); });
  s.currency = s.earned.sub(spent); grantAchievements(s); return s;
}
function memory() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
}

describe('連鎖伝播', () => {
  it('1ステップ内の全段を同時更新し、生成数は小数、価格と研究条件は購入数だけを使う', () => {
    const s = createState(now); s.owned[0] = s.owned[1] = s.owned[2] = 1;
    s.prestige.upgrades.push('chain'); const price = cost(s, 0);
    advance(s, 0.05);
    expect(s.generated[0].toNumber()).toBeCloseTo(0.00005, 12);
    expect(s.generated[1].toNumber()).toBeCloseTo(0.00005, 12);
    expect(s.generated[2].eq(0)).toBe(true);
    s.generated[0] = new Decimal('1e500'); expect(cost(s, 0).eq(price)).toBe(true);
    s.currency = new Decimal('1e500'); expect(buyUpgrade(s, 'neighbors-10')).toBe(false);
    expect(production(s).gt('1e499')).toBe(true);
  });
  it('購入していない段へ飛び越して生成しない', () => {
    const s = createState(now); s.owned[2] = 1; s.prestige.upgrades.push('chain');
    advance(s, 3600); expect(s.generated.every(n => n.eq(0))).toBe(true);
    s.owned[1] = 1; advance(s, 10);
    expect(s.generated[1].gt(0)).toBe(true); expect(s.generated[0].eq(0)).toBe(true);
    s.startingNeighbors = s.owned[0] = 5; advance(s, 10); expect(s.generated[0].eq(0)).toBe(true);
    s.currency = new Decimal(10); expect(buy(s, 0, 1)).toBe(true); advance(s, 1); expect(s.generated[0].gt(0)).toBe(true);
  });
  it('多段階のまとめ計算が50msの逐次更新と一致する', () => {
    const whole = rich(); buyPermanentUpgrade(whole, 'chain'); const split = clone(whole);
    const before = whole.currency, a = advance(whole, 100);
    let b = new Decimal(0); for (let i = 0; i < 2000; i++) b = b.add(advance(split, 0.05));
    expect(a.div(b).toNumber()).toBeCloseTo(1, 8);
    expect(whole.currency.sub(before).div(a).toNumber()).toBeCloseTo(1, 8);
    whole.generated.forEach((n, i) => expect(n.sub(split.generated[i]).abs().div(n.add(1)).toNumber()).toBeLessThan(1e-8));
    expect(inconsistent(whole, now)).toBe(false);
  });
  it('倍率を生成速度へ流用せず、8時間分を有限の巨大数で計算する', () => {
    const s = rich(); buyPermanentUpgrade(s, 'chain'); const other = clone(s); other.myth.count = 100;
    const a = chainEvolution(s, 28800), b = chainEvolution(other, 28800);
    expect(a.generated.map(n => n.toString())).toEqual(b.generated.map(n => n.toString()));
    expect(a.generated.every(n => n.isFinite())).toBe(true);
    const next = createPrestigeState(s, now)!; expect(next.generated.every(n => n.eq(0))).toBe(true);
  });
});

describe('神話と試練', () => {
  it('神話編纂の2条件を必要とし、語り草・永続研究・生成数をリセットして生涯記録を保持する', async () => {
    const s = rich(); expect(inconsistent(s, now)).toBe(false);
    buyPermanentUpgrade(s, 'chain'); buyPermanentUpgrade(s, 'inheritance'); advance(s, 1);
    const before = serialize(s), next = compileMyth(s, now)!;
    expect(serialize(s)).toBe(before); expect(next.myth.count).toBe(1);
    expect(next.prestige.total.eq(0)).toBe(true); expect(next.prestige.points.eq(0)).toBe(true);
    expect(next.prestige.upgrades).toEqual([]); expect(next.owned.every(n => n === 0)).toBe(true);
    expect(next.generated.every(n => n.eq(0))).toBe(true); expect(next.prestige.count).toBe(s.prestige.count);
    expect(next.lifetimeEarned.eq(s.lifetimeEarned)).toBe(true);
    expect(s.achievements.every(id => next.achievements.includes(id))).toBe(true);
    expect(inconsistent(next, now)).toBe(false); expect((await decode(await encode(next), now)).tainted).toBe(false);
    expect(compileMyth(next, now)).toBeNull();
    s.prestige.total = new Decimal(99); expect(compileMyth(s, now)).toBeNull();
    s.prestige.total = new Decimal(100); s.earned = new Decimal('999999999999'); expect(compileMyth(s, now)).toBeNull();
  });
  it('神話と異なる試練の報酬を乗算し、同じ試練は何度クリアしても報酬を重ねない', () => {
    const s = rich(1); const started = startChallenge(s, 'alleys', now)!;
    started.earned = mythBalance.challengeGoal; const next = leaveChallenge(started, now, true)!;
    expect(next.challenge.completed).toEqual(['alleys']); expect(next.earned.eq(0)).toBe(true);
    expect(next.prestige.total.eq(s.prestige.total)).toBe(true); expect(next.prestige.count).toBe(s.prestige.count);
    expect(mythMultiplier(next).toNumber()).toBeCloseTo(1.65);
    const again = startChallenge(next, 'alleys', now)!; again.earned = mythBalance.challengeGoal;
    expect(leaveChallenge(again, now, true)!.challenge.completed).toEqual(['alleys']);
    expect(inconsistent(next, now)).toBe(false);
  });
  it('無言の街は引き継ぎ研究を必要とし、5組から始め、クリックを無効にする', () => {
    const s = rich(1); expect(startChallenge(s, 'silent', now)).toBeNull();
    buyPermanentUpgrade(s, 'inheritance'); const next = startChallenge(s, 'silent', now)!;
    expect(next.owned[0]).toBe(5); expect(next.startingNeighbors).toBe(5);
    const before = serialize(next); whisper(next); expect(serialize(next)).toBe(before);
    expect(clickGain(next).eq(0)).toBe(true); expect(advance(next, 10).gt(0)).toBe(true);
    expect(inconsistent(next, now)).toBe(false);
  });
  it('閉じた路地は5種目以降の購入・研究を拒否し、夢のない夜は生成を止める', () => {
    const s = rich(1); buyPermanentUpgrade(s, 'chain');
    const alleys = startChallenge(s, 'alleys', now)!; alleys.currency = new Decimal('1e100'); alleys.earned = alleys.currency;
    alleys.owned[4] = 10;
    expect(buy(alleys, 4, 1)).toBe(false); expect(buyUpgrade(alleys, 'broadcast-10')).toBe(false);
    const dreamless = startChallenge(s, 'dreamless', now)!; dreamless.owned[0] = dreamless.owned[1] = 1;
    advance(dreamless, 1000); expect(dreamless.generated.every(n => n.eq(0))).toBe(true);
  });
  it('挑戦中の通常転生・神話・自動転生を停止し、中断は報酬なしで周回だけを戻す', () => {
    const s = rich(3); s.automation.prestige = true;
    const next = startChallenge(s, 'alleys', now)!; next.earned = prestigeBalance.requirement;
    expect(shouldAutoPrestige(next)).toBe(false); expect(createPrestigeState(next, now)).toBeNull();
    expect(compileMyth(next, now)).toBeNull();
    const abandoned = leaveChallenge(next, now)!;
    expect(abandoned.challenge.active).toBeNull(); expect(abandoned.challenge.completed).toEqual([]);
    expect(abandoned.prestige.total.eq(s.prestige.total)).toBe(true);
    expect(leaveChallenge(startChallenge(s, 'alleys', now)!, now, true)).toBeNull();
  });
});

describe('自動化', () => {
  it('神話数に応じて個別に解放し、初期OFF・対象・優先順・数値を検査する', () => {
    const s = createState(now); expect(s.automation.purchase).toBe(false);
    expect(configureAutomation(s, { kind: 'toggle', target: 'purchase', enabled: true })).toBe(false);
    s.myth.count = 1;
    expect(configureAutomation(s, { kind: 'toggle', target: 'purchase', enabled: true })).toBe(true);
    expect(configureAutomation(s, { kind: 'toggle', target: 'research', enabled: true })).toBe(false);
    expect(configureAutomation(s, { kind: 'move', index: 2, offset: -1 })).toBe(true);
    expect(s.automation.order.slice(0, 3)).toEqual([0, 2, 1]);
    expect(configureAutomation(s, { kind: 'number', target: 'reserve', value: '1e500' })).toBe(true);
    s.myth.count = 3;
    for (const value of ['-1', 'NaN', '0', '1.5', '']) expect(configureAutomation(s, { kind: 'number', target: 'threshold', value })).toBe(false);
    expect(configureAutomation(s, { kind: 'number', target: 'threshold', value: '10' })).toBe(true);
  });
  it('1秒境界で購入し、停止・対象外・最低保持伝聞を守る', () => {
    const s = createState(now); s.myth.count = 1; s.currency = s.earned = new Decimal(20);
    s.automation.purchase = true; s.automation.targets.fill(false); s.automation.targets[0] = true; s.automation.reserve = new Decimal(10);
    advanceWorld(s, 0.95, false); expect(s.owned[0]).toBe(0);
    advanceWorld(s, 0.05, false); expect(s.owned[0]).toBe(1); expect(s.currency.eq(10)).toBe(true);
    advanceWorld(s, 1, false); expect(s.owned[0]).toBe(1);
    s.automation.purchase = false; s.currency = new Decimal(1000); advanceWorld(s, 10, false); expect(s.owned[0]).toBe(1);
  });
  it('優先順に購入し、自動研究は2編から、同じ研究を二重購入しない', () => {
    const s = rich(1); s.automation.research = true; s.upgrades = []; automate(s); expect(s.upgrades).toEqual([]);
    s.myth.count = 2; automate(s); expect(s.upgrades.length).toBeGreaterThan(0);
    const spent = s.currency; automate(s); expect(s.currency.eq(spent)).toBe(true);
    const p = createState(now); p.myth.count = 1; p.automation.purchase = true;
    p.owned[0] = 1; p.currency = new Decimal(75); p.earned = new Decimal(100);
    p.automation.order = [1, 0, 2, 3, 4, 5, 6, 7, 8, 9]; automate(p);
    expect(p.owned[1]).toBe(1); expect(p.owned[0]).toBe(1);
  });
  it('自動購入を含むオンラインとオフラインの進行が一致し、オフラインで自動転生しない', () => {
    const s = rich(3); buyPermanentUpgrade(s, 'chain');
    s.automation.purchase = s.automation.research = s.automation.prestige = true;
    const split = clone(s); const count = s.prestige.count;
    catchUp(s, now + 30000);
    for (let i = 0; i < 600; i++) advanceWorld(split, 0.05, false);
    expect(s.owned).toEqual(split.owned); expect(s.upgrades).toEqual(split.upgrades);
    expect(s.currency.div(split.currency).toNumber()).toBeCloseTo(1, 7);
    expect(s.prestige.count).toBe(count); expect(s.lastOfflineGenerated.some(n => n.gt(0))).toBe(true);
    expect(inconsistent(s, now + 30000)).toBe(false);
  });
});

describe('Phase 6の保存・確認', () => {
  it('全状態を署名付きで往復し、署名付きv5からも進行を維持して移行する', async () => {
    const s = rich(3); buyPermanentUpgrade(s, 'chain'); advance(s, 30); s.automation.purchase = true;
    const loaded = await decode(await encode(s), now);
    expect(loaded.tainted).toBe(false); expect(serialize(loaded)).toBe(serialize(s));
    const old = JSON.parse(serialize(rich())) as Record<string, unknown>;
    for (const key of ['generated', 'lastOfflineGenerated', 'myth', 'challenge', 'automation', 'preferences', 'mail']) delete old[key]; old.version = 5;
    const message = `rumor|v5|${toBase64Url(await compress(JSON.stringify(old)))}`;
    const migrated = await inspect(`${message}|${toBase64Url(await signature(message))}`, now);
    expect(migrated.signatureValid).toBe(true); expect(migrated.state.tainted).toBe(false);
    expect(migrated.state.prestige.total.eq(100)).toBe(true); expect(migrated.state.myth.count).toBe(0);
  });
  it('神話編纂のキャンセル・保存失敗では元の進行を保ち、成功時だけ採用する', async () => {
    const storage = memory(); let full = false;
    const port: StoragePort = { ...storage, setItem(k, v) { if (full) throw new Error('full'); storage.setItem(k, v); } };
    const session = await openSave(port, now); await session.replace(rich()); let confirm = false;
    const actions = createSaveActions(session, { synchronize() {}, changed() {}, notify() {}, confirm: () => confirm });
    const before = serialize(session.state); await actions.progression('myth'); expect(serialize(session.state)).toBe(before);
    confirm = true; full = true; await actions.progression('myth'); expect(serialize(session.state)).toBe(before);
    full = false; await actions.progression('myth'); expect(session.state.myth.count).toBe(1);
    expect((await openSave(port, now)).state.tainted).toBe(false);
  });
  it('自動伝説化は有効化としきい値を必要とし、確認なしで一度だけ保存して転生する', async () => {
    const storage = memory(), session = await openSave(storage, now); await session.replace(rich(3));
    let prompts = 0;
    const actions = createSaveActions(session, { synchronize() {}, changed() {}, notify() {}, confirm() { prompts++; return false; } });
    await actions.prestige(true); expect(session.state.prestige.count).toBe(4);
    session.state.automation.prestige = true; session.state.automation.threshold = new Decimal(101);
    await actions.prestige(true); expect(session.state.prestige.count).toBe(4);
    session.state.automation.threshold = new Decimal(100); await actions.prestige(true); await actions.prestige(true);
    expect(session.state.prestige.count).toBe(5); expect(prompts).toBe(0);
  });
  it('破損した生成数・順番・しきい値は拒否し、未解放の自動化と生成・神話の不整合を検出する', async () => {
    const s = rich();
    for (const patch of [{ generated: ['0'] }, { automation: { ...s.automation, order: [0, 0] } },
      { automation: { ...s.automation, reserve: '0', threshold: '0' } }]) {
      const data = { ...(JSON.parse(serialize(s)) as object), ...patch };
      await expect(decode(await encodeSnapshot(JSON.stringify(data)), now)).rejects.toThrow();
    }
    for (const patch of [{ generated: ['1', ...Array<string>(9).fill('0')] },
      { myth: { count: 1, archivedPoints: '0', archivedPrestiges: 0 } },
      { automation: { ...s.automation, purchase: true, reserve: '0', threshold: '1' } }]) {
      const data = { ...(JSON.parse(serialize(s)) as object), ...patch };
      expect((await decode(await encodeSnapshot(JSON.stringify(data)), now)).tainted).toBe(true);
    }
  });
  it('自動伝説化の保存に失敗した場合は周回を保持して自動実行をOFFにする', async () => {
    const storage = memory(); let full = false;
    const port: StoragePort = { ...storage, setItem(key, value) { if (full) throw new Error('full'); storage.setItem(key, value); } };
    const session = await openSave(port, now); const source = rich(3); source.automation.prestige = true; await session.replace(source);
    const actions = createSaveActions(session, { synchronize() {}, changed() {}, notify() {}, confirm: () => true });
    full = true; await actions.prestige(true);
    expect(session.state.prestige.count).toBe(source.prestige.count);
    expect(session.state.earned.eq(source.earned)).toBe(true); expect(session.state.automation.prestige).toBe(false);
  });
});
