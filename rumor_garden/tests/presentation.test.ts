import Decimal from 'break_eternity.js';
import { describe, expect, it, vi } from 'vitest';
import { createState } from '../src/state/game';
import { createPreferences, parsePreferences } from '../src/state/preferences';
import { createRunState } from '../src/systems/prestige';
import { advance, buy, whisper } from '../src/systems/economy';
import { grantAchievements } from '../src/systems/achievements';
import { catchUp } from '../src/core/time';
import { catchUpAsync } from '../src/core/offline';
import { parseState } from '../src/save/state-format';
import { decode, encode, inspect, serialize } from '../src/save/codec';
import { compress } from '../src/save/compression';
import { signature, toBase64Url } from '../src/save/crypto';
import { openSave } from '../src/save/storage';
import { createSaveActions } from '../src/save/actions';
import { motionAllowed } from '../src/ui/feedback';
import { createAudio } from '../src/ui/audio';

const now = 1_800_000_000_000;
function played() {
  const s = createState(now); for (let i=0;i<50;i++) whisper(s); buy(s,0,1); advance(s,60); s.lastUpdatedAt=now+60000; return s;
}
const clone = (state: ReturnType<typeof createState>) => parseState(JSON.parse(serialize(state)) as unknown);
describe('見え方と保存', () => {
  it('音は操作前に作らず、音量0・OFF・非表示で発音しない', () => {
    const p = createPreferences(), gainValues: number[] = []; let contexts = 0, notes = 0;
    const page = { hidden: false };
    class AudioStub {
      state = 'running'; currentTime = 0; destination = {};
      constructor() { contexts++; }
      createGain() { return { gain: { setValueAtTime: (v: number) => gainValues.push(v), exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
      createOscillator() { notes++; return { frequency: { value: 0 }, type: '', connect() {}, disconnect() {}, start() {}, stop() {}, onended: null }; }
    }
    vi.stubGlobal('AudioContext', AudioStub); vi.stubGlobal('document', page);
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    try {
      const audio = createAudio(() => p); audio.unlock(); audio.play('click'); expect(contexts).toBe(0);
      p.sound = true; audio.play('click'); expect(contexts).toBe(0);
      audio.unlock(); audio.play('click'); expect(contexts).toBe(1); expect(notes).toBe(1);
      p.volume = 0; audio.sync(); audio.play('buy'); expect(gainValues.at(-1)).toBe(0); expect(notes).toBe(1);
      p.volume = 0.5; p.sound = false; audio.sync(); expect(gainValues.at(-1)).toBe(0);
      p.sound = true; page.hidden = true; audio.play('reset'); expect(notes).toBe(1);
    } finally { vi.unstubAllGlobals(); vi.restoreAllMocks(); }
  });
  it('初期は夜・音OFF・30秒保存で、端末の演出低減を優先する', () => {
    const p = createPreferences(); expect(p.theme).toBe('dark'); expect(p.sound).toBe(false); expect(p.autosaveSeconds).toBe(30);
    expect(motionAllowed(p,false)).toBe(true); expect(motionAllowed(p,true)).toBe(false);
    expect(motionAllowed({...p,effects:false},false)).toBe(false);
  });
  it('範囲外の音量・間隔・不明な配色・未知フィールドを拒否する', () => {
    for(const patch of [{volume:-1},{volume:2},{volume:NaN},{autosaveSeconds:0},{theme:'other'},{unknown:true},{sound:'on'}]) {
      expect(()=>parsePreferences({...createPreferences(),...patch})).toThrow();
    }
  });
  it('配色・音量・演出・間隔を往復し、周回リセット後も保持する', async () => {
    const s=played(); s.preferences={theme:'light',effects:false,sound:true,volume:0.4,autosaveSeconds:60};
    const loaded=await decode(await encode(s),now+60000); expect(loaded.tainted).toBe(false);
    expect(serialize(loaded)).toBe(serialize(s));
    const next=createRunState(s,now+60000); expect(next.preferences).toEqual(s.preferences);
    next.preferences.volume=0; expect(s.preferences.volume).toBe(0.4);
  });
  it('署名付きv6のゲーム進行を維持して、設定の初期値を追加する', async () => {
    const s=played(), data=JSON.parse(serialize(s)) as Record<string,unknown>; delete data.preferences; delete data.mail; data.version=6;
    const message=`rumor|v6|${toBase64Url(await compress(JSON.stringify(data)))}`;
    const loaded=await inspect(`${message}|${toBase64Url(await signature(message))}`,now+60000);
    expect(loaded.signatureValid).toBe(true); expect(loaded.state.tainted).toBe(false);
    expect(loaded.state.preferences).toEqual(createPreferences()); expect(loaded.state.currency.eq(s.currency)).toBe(true);
  });
});
describe('画面へ制御を返すオフライン進行', () => {
  it('通常の一括計算と、8時間上限・報告・再請求防止が一致する', async () => {
    const sync=played(), asyncState=clone(sync); const end=now+16*3600000;
    const a=catchUp(sync,end), b=await catchUpAsync(asyncState,end);
    expect(a.eq(b)).toBe(true); expect(serialize(asyncState)).toBe(serialize(sync));
    expect(asyncState.lastOffline.capped).toBe(true); expect((await catchUpAsync(asyncState,end)).eq(0)).toBe(true);
  });
  it('連鎖と自動化でも進行結果を保ち、予算ごとに描画機会と進捗を渡す', async () => {
    const s=createState(now); s.owned.fill(3); s.currency=s.earned=s.lifetimeEarned=new Decimal('1e14');
    s.myth.count=2; s.prestige.upgrades=['chain']; s.automation.purchase=s.automation.research=true; grantAchievements(s);
    const sync=clone(s), asyncState=clone(s), progress:number[]=[]; let ticks=0, yields=0;
    catchUp(sync,now+60000);
    await catchUpAsync(asyncState,now+60000,{clock:()=>{ticks+=9;return ticks;},yieldControl:async()=>{yields++;},progress:n=>progress.push(n)});
    expect(yields).toBeGreaterThan(1); expect(progress[0]).toBe(0); expect(progress.at(-1)).toBe(1);
    expect(progress.every((n,i)=>i===0||n>=progress[i-1])).toBe(true);
    expect(asyncState.owned).toEqual(sync.owned); expect(asyncState.upgrades).toEqual(sync.upgrades);
    expect(asyncState.currency.div(sync.currency).toNumber()).toBeCloseTo(1,9);
    expect(asyncState.generated.map(n=>n.toString())).toEqual(sync.generated.map(n=>n.toString()));
    expect(asyncState.prestige.count).toBe(sync.prestige.count);
  });
  it('未来時刻から負の報酬を与えない', async () => {
    const s=played(), before=s.currency;
    expect((await catchUpAsync(s,now)).eq(0)).toBe(true); expect(s.currency.eq(before)).toBe(true);
  });
  it('復帰処理の失敗時にはインポート元を採用せず、現在の保存を保つ', async () => {
    const values=new Map<string,string>();
    const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};
    const session=await openSave(storage,Date.now()); const before=serialize(session.state);
    const actions=createSaveActions(session,{synchronize(){},changed(){},notify(){},confirm:()=>true,catchUp:async()=>{throw new Error('interrupted');}});
    await actions.importText(await encode(played())); expect(serialize(session.state)).toBe(before);
  });
});
