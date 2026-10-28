import Decimal from 'break_eternity.js';
import { decode, encode } from '../src/save/codec';
import { simulate } from './simulate';
import { buyPermanentUpgrade, createPrestigeState } from '../src/systems/prestige';
import { startChallenge, leaveChallenge } from '../src/systems/myth';
import { challengeIds, mythBalance } from '../src/data/myth';
import { advanceWorld } from '../src/core/progression';
import { startTale, continueTale } from '../src/minigames/tale/game';
import { startMail, answerMail, mailCost } from '../src/minigames/mail/game';
import { mailBalance as b } from '../src/data/mail';
import { canReadEpilogue, readEpilogue } from '../src/systems/chronicle';
import { inconsistent } from '../src/save/validation';

// Continue the legitimate three-myth campaign; never overwrite owned counts or rolls.
export async function runPhase8(raw: string, publish: (name: string, raw: string) => Promise<void>) {
  let s=await decode(raw,Date.now()); if(s.tainted||s.myth.count<3)throw new Error('Need normal three-myth campaign fixture');
  const started=s.playSeconds, challenges=[];
  s.automation.purchase=s.automation.research=s.automation.prestige=false;
  if(!s.prestige.upgrades.includes('inheritance')) {
    s=simulate('active',86400,{startState:s,stopAt:new Decimal('1e19'),stepSeconds:1}).state;
    const next=createPrestigeState(s,s.lastUpdatedAt); if(!next)throw new Error('Need lore'); s=next;
    if(!buyPermanentUpgrade(s,'inheritance'))throw new Error('Need inheritance');
  }
  for(const id of challengeIds) {
    const start=startChallenge(s,id,s.lastUpdatedAt); if(!start)throw new Error(`Cannot start ${id}`);
    s=simulate('active',86400,{startState:start,stopAt:mythBalance.challengeGoal,stepSeconds:1}).state;
    const finish=leaveChallenge(s,s.lastUpdatedAt,true); if(!finish)throw new Error(`Cannot finish ${id}`);
    challenges.push({id,seconds:s.runSeconds,valid:!inconsistent(finish,finish.lastUpdatedAt)}); s=finish;
  }
  s=simulate('active',86400,{startState:s,stopAt:new Decimal('1e7'),stepSeconds:1}).state;
  const advance=(seconds:number)=>{advanceWorld(s,seconds,false);s.lastUpdatedAt+=seconds*1000;};
  let attempts=0;
  while(!s.tale.illustration && attempts<100) {
    advance(s.tale.tickets>0?10:900);
    if(!startTale(s,'bold'))throw new Error('Cannot start tale'); attempts++;
    while(s.tale.round) { advance(10); if(s.tale.round?.phase==='decision')continueTale(s,'bold'); }
  }
  if(!s.tale.illustration)throw new Error('No illustration');
  const mailStarted=s.playSeconds, balanceBefore=s.currency, earnedBefore=s.earned;
  let fees=new Decimal(0);
  const snapshot=async(name:string)=>publish(name,await encode({...s,lastUpdatedAt:Date.now()}));
  await snapshot('phase8-mail-ready.txt');
  for(let i=0;i<b.postcards.length;i++) {
    if(s.mail.tickets===0)advance(b.rechargeSeconds-s.mail.recharge);
    if(s.currency.lt(mailCost(s)))advance(10);
    fees=fees.add(mailCost(s)); if(!startMail(s))throw new Error('Cannot start mail');
    for(let j=0;j<b.stages;j++) {
      if(i===5 && j===2)await snapshot('phase8-mail-last-choice.txt');
      if(!answerMail(s,s.mail.round!.destinations[j]))throw new Error('Cannot answer'); advance(b.stageSeconds);
    }
  }
  const mailSeconds=s.playSeconds-mailStarted, valid=!inconsistent(s,s.lastUpdatedAt);
  const income=s.earned.sub(earnedBefore), delta=s.currency.sub(balanceBefore);
  await snapshot('phase8-ending-ready.txt');
  const unlocked=canReadEpilogue(s), read=readEpilogue(s); await snapshot('phase8-ending-seen.txt');
  return { source:'phase6-automation-ready.txt', seed:s.seed, challenges, taleAttempts:attempts,
    mailSeconds, mailPlays:s.mail.plays, postcards:s.mail.postcards, fees:fees.toString(),
    onlyIncomeMinusFees:delta.sub(income.sub(fees)).abs().lte('0.001'),
    epilogueUnlocked:unlocked, epilogueRead:read, valid, validAfterRead:!inconsistent(s,s.lastUpdatedAt),
    additionalSeconds:s.playSeconds-started, totalCampaignSeconds:s.playSeconds };
}
