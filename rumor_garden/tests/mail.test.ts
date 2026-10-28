import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { createState, type GameState } from '../src/state/game';
import { startMail, answerMail, mailCost } from '../src/minigames/mail/game';
import { unlockMail, finishMail } from '../src/minigames/mail/clock';
import { mailBalance as b } from '../src/data/mail';
import { advance, production } from '../src/systems/economy';
import { grantAchievements } from '../src/systems/achievements';
import { unlockTale } from '../src/minigames/tale/clock';
import { createRunState } from '../src/systems/prestige';
import { canReadEpilogue, readEpilogue } from '../src/systems/chronicle';
import { decode, encode, serialize, inspect } from '../src/save/codec';
import { parseState } from '../src/save/state-format';
import { compress } from '../src/save/compression';
import { signature, toBase64Url } from '../src/save/crypto';
import { inconsistent } from '../src/save/validation';
import { catchUp } from '../src/core/time';
import { openSave } from '../src/save/storage';
import { createSaveActions } from '../src/save/actions';

const now=1_800_000_000_000;
function ready() {
  const s=createState(now); s.seed=20261028; s.myth={count:3,archivedPoints:new Decimal(300),archivedPrestiges:300};
  s.prestige.count=300; s.earned=new Decimal(100000); s.currency=new Decimal(99990); s.owned[0]=1;
  s.lifetimeEarned=new Decimal('3e19'); s.runClicks=s.clicks=100000; s.runSeconds=1000; s.playSeconds=200000;
  grantAchievements(s); unlockTale(s); unlockMail(s); return s;
}
function clone(s:GameState) { return parseState(JSON.parse(serialize(s)) as unknown); }
function deliver(s:GameState, correct=3) {
  expect(startMail(s)).toBe(true);
  for(let i=0;i<b.stages;i++) {
    const target=s.mail.round!.destinations[i];
    expect(answerMail(s,i<correct?target:(target+1)%b.destinations)).toBe(true); advance(s,b.stageSeconds);
  }
}
function ending(s:GameState) {
  s.challenge.completed=['silent','alleys','dreamless'];
  s.records.bestRunEarned=new Decimal('1e7'); s.tale.bestPoints=6; s.tale.illustration=true;
  s.tale.plays=s.tale.completed=s.tale.wins=1;
  s.mail.plays=s.mail.completed=s.mail.deliveries=6; s.mail.postcards=[...b.postcards];
}
describe('夜便の仕分け',()=> {
  it('神話・累計・費用・券・重複開始の条件を守り、費用と乱数を一度だけ消費する',()=> {
    expect(startMail(createState(now))).toBe(false); const s=ready(); expect(inconsistent(s,now)).toBe(false);
    s.myth.count=0; expect(startMail(s)).toBe(false); s.myth.count=3;
    s.earned=new Decimal(49999); expect(startMail(s)).toBe(false); s.earned=new Decimal(100000);
    s.currency=new Decimal(999); expect(startMail(s)).toBe(false); s.currency=new Decimal(99990);
    s.mail.tickets=0; expect(startMail(s)).toBe(false); s.mail.tickets=3;
    const seed=s.seed,fee=mailCost(s),balance=s.currency; expect(startMail(s)).toBe(true);
    expect(s.currency.eq(balance.sub(fee))).toBe(true); expect(s.mail.spent.eq(fee)).toBe(true);
    expect(s.mail.tickets).toBe(2); expect(s.seed).not.toBe(seed); const after=serialize(s);
    expect(startMail(s)).toBe(false); expect(serialize(s)).toBe(after); expect(inconsistent(s,now)).toBe(false);
  });
  it('一時倍率を費用へ含めず、待機前の回答・連打・不正な宛先を拒否する',()=> {
    const s=ready(),fee=mailCost(s); s.events.boost=30; s.tale.boost=60; expect(mailCost(s).eq(fee)).toBe(true);
    expect(answerMail(s,0)).toBe(false); startMail(s); expect(answerMail(s,3)).toBe(false);
    expect(answerMail(s,1)).toBe(true); expect(answerMail(s,2)).toBe(false); advance(s,9.95);
    expect(answerMail(s,0)).toBe(false); advance(s,0.05); expect(s.mail.round!.stage).toBe(1);
    expect(s.mail.round!.phase).toBe('ready');
  });
  it('2問正解で1枚・1問では0枚。主通貨や生産倍率を報酬で増やさない',()=> {
    const s=ready(),base=production(s),balance=s.currency,cost=mailCost(s); deliver(s,2);
    expect(s.mail.postcards).toEqual(['lamp']); expect(s.mail.lastCorrect).toBe(2);
    expect(s.currency.sub(balance.sub(cost)).div(base).toNumber()).toBeCloseTo(30,8);
    expect(production(s).eq(base)).toBe(true); deliver(s,1); expect(s.mail.postcards).toEqual(['lamp']);
    expect(s.mail.completed).toBe(2); expect(s.mail.deliveries).toBe(1); expect(finishMail(s,3)).toBe(false);
    expect(inconsistent(s,now)).toBe(false);
  });
  it('6枚は重複なしでそろい、完成後もコレクションが増え続けない',()=> {
    const s=ready();
    for(let i=0;i<8;i++) { if(s.mail.tickets===0) advance(s,900); deliver(s); }
    expect(s.mail.postcards).toEqual([...b.postcards]); expect(s.mail.deliveries).toBe(8);
    expect(inconsistent(s,now)).toBe(false);
  });
  it('再読込でも問題・回答を保ち、オフラインは配達中の1通だけ完了して選択を待つ',async()=> {
    const s=ready(); startMail(s); answerMail(s,s.mail.round!.destinations[0]);
    const loaded=await decode(await encode(s),now); expect(serialize(loaded)).toBe(serialize(s));
    catchUp(loaded,now+16*3600000); expect(loaded.mail.round!.stage).toBe(1); expect(loaded.mail.round!.phase).toBe('ready');
    expect(loaded.mail.tickets).toBe(3); expect(loaded.mail.recharge).toBe(0); expect(loaded.mail.postcards).toEqual([]);
    expect(loaded.lastOffline.seconds).toBe(28800); expect(inconsistent(loaded,now+16*3600000)).toBe(false);
  });
  it('15分回復を上限で止め、満タン中の回復を貯金しない',()=> {
    const s=ready(); advance(s,9000); startMail(s); advance(s,899.95); expect(s.mail.tickets).toBe(2);
    advance(s,0.05); expect(s.mail.tickets).toBe(3); expect(s.mail.recharge).toBe(0);
  });
  it('留守中に最後の配達が終われば1枚だけ登録し、復帰を繰り返しても二重付与しない',()=> {
    const s=ready(); startMail(s);
    for(let i=0;i<2;i++) { answerMail(s,s.mail.round!.destinations[i]); advance(s,10); }
    answerMail(s,s.mail.round!.destinations[2]);
    catchUp(s,now+3600000); expect(s.mail.postcards).toEqual(['lamp']); expect(s.mail.round).toBeNull();
    catchUp(s,now+7200000); expect(s.mail.postcards).toEqual(['lamp']); expect(s.mail.completed).toBe(1);
    expect(inconsistent(s,now+7200000)).toBe(false);
  });
  it('周回では券・途中回復・成績・絵葉書を保持し、現在の便と支出を消す',()=> {
    const s=ready(); deliver(s); startMail(s); advance(s,123); const next=createRunState(s,now);
    expect(next.mail.postcards).toEqual(['lamp']); expect(next.mail.tickets).toBe(s.mail.tickets);
    expect(next.mail.recharge).toBe(s.mail.recharge); expect(next.mail.round).toBeNull(); expect(next.mail.spent.eq(0)).toBe(true);
    next.mail.postcards.push('well'); expect(s.mail.postcards).toEqual(['lamp']); expect(startMail(next)).toBe(false);
  });
});
describe('年代記と保存v8',()=> {
  it('4条件が全部必要で、保存する一区切りは一度だけ。周回後も読み返せる',()=> {
    const s=ready(); expect(canReadEpilogue(s)).toBe(false); ending(s);
    for(const remove of [(x:GameState)=>{x.myth.count=2;},(x:GameState)=>{x.challenge.completed.pop();},
      (x:GameState)=>{x.tale.illustration=false;},(x:GameState)=>{x.mail.postcards.pop();}]) {
      const missing=clone(s); remove(missing); expect(readEpilogue(missing)).toBe(false);
    }
    const before=s.currency; expect(readEpilogue(s)).toBe(true); expect(readEpilogue(s)).toBe(false);
    expect(s.currency.eq(before)).toBe(true); expect(createRunState(s,now).mail.epilogueSeen).toBe(true);
    expect(inconsistent(s,now)).toBe(false);
  });
  it('署名付きv7を移行し、既存の進行と設定を保つ',async()=> {
    const s=ready(); s.preferences.theme='light'; const data=JSON.parse(serialize(s)) as Record<string,unknown>;
    delete data.mail; data.version=7; const msg=`rumor|v7|${toBase64Url(await compress(JSON.stringify(data)))}`;
    const loaded=await inspect(`${msg}|${toBase64Url(await signature(msg))}`,now);
    expect(loaded.signatureValid).toBe(true); expect(loaded.state.tainted).toBe(false);
    expect(loaded.state.preferences.theme).toBe('light'); expect(loaded.state.mail.postcards).toEqual([]);
  });
  it('破損した配列・時間・重複・未知キーを拒否し、矛盾した収集やエピローグには改造印を付ける',async()=> {
    const s=ready(); startMail(s);
    for(const mutate of [(x:Record<string,unknown>)=>{x.unknown=true;},(x:Record<string,unknown>)=>{x.tickets=4;},
      (x:Record<string,unknown>)=>{x.postcards=['lamp','lamp'];},(x:Record<string,unknown>)=>{x.round={destinations:[0],variants:[0],answers:[],stage:0,phase:'ready',remaining:0};}]) {
      const data=JSON.parse(serialize(s)) as {mail:Record<string,unknown>}; mutate(data.mail); expect(()=>parseState(data)).toThrow();
    }
    s.mail.postcards=['lamp']; expect((await decode(await encode(s),now)).tainted).toBe(true);
    s.mail.postcards=[]; s.mail.epilogueSeen=true; expect((await decode(await encode(s),now)).tainted).toBe(true);
  });
  it('開始・回答・年代記の保存失敗で状態を採用せず、連打でも二重に券を使わない',async()=> {
    const values=new Map<string,string>(); let fail=false;
    const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{if(fail)throw new Error('full');values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};
    const session=await openSave(storage,now); await session.replace(ready());
    const actions=createSaveActions(session,{synchronize(){},changed(){},notify(){},confirm:()=>true});
    const before=serialize(session.state); fail=true; await actions.mail('start'); expect(serialize(session.state)).toBe(before);
    fail=false; await Promise.all([actions.mail('start'),actions.mail('start')]); expect(session.state.mail.plays).toBe(1);
    const started=serialize(session.state); fail=true; await actions.mail('answer',0); expect(serialize(session.state)).toBe(started);
    ending(session.state); session.state.mail.round=null; const unread=serialize(session.state);
    await actions.mail('read'); expect(serialize(session.state)).toBe(unread);
  });
});
