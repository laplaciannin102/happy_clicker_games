import { ja } from '../i18n/ja';
import { mailBalance as b } from '../data/mail';
import { mailAvailable, mailCost } from '../minigames/mail/game';
import { canReadEpilogue, chronicleProgress } from '../systems/chronicle';
import type { GameState } from '../state/game';
import { node, setHidden, updateText } from './dom';
import { formatNumber } from './format';
import { artwork } from './assets';

export type MailAction = (operation: 'start' | 'answer' | 'read', destination?: number) => void;
export function createMailPanel(state: GameState, action: MailAction) {
  const panel = node('section', '', 'mail-panel');
  const tickets = node('p'), fee = node('p'), wallet = node('p'), stage = node('h3'), clue = node('blockquote');
  const status = node('p'); status.setAttribute('role','status');
  const progress = node('progress'); progress.max = b.stageSeconds; progress.setAttribute('aria-label',ja.mailTitle);
  const start = node('button',ja.mailStart); start.type='button'; start.addEventListener('click',()=>action('start'));
  const choices = node('div','','mail-choices');
  const buttons = ja.mailDestinations.map((name,i) => {
    const button=node('button',name); button.type='button'; button.addEventListener('click',()=>action('answer',i)); choices.append(button); return button;
  });
  const result=node('p'), record=node('p','','muted small'), collection=node('section'), count=node('p');
  const grid=node('div','','postcard-grid');
  const cards=b.postcards.map((_,i)=> {
    const card=node('article','','postcard'), art=artwork(b.postcardAssets[i],'postcard-art',ja.postcardSymbols[i]);
    const title=node('h4'), text=node('p'); card.append(art,title,text); grid.append(card); return {card,art,title,text};
  });
  collection.append(node('h3',ja.postcardTitle),count,grid);
  const chronicle=node('section','','chronicle'), goals=node('ul'), rows=ja.chronicleGoals.map(()=>node('li'));
  goals.append(...rows); const read=node('button',ja.chronicleRead); read.type='button'; read.addEventListener('click',()=>action('read'));
  const ending=node('article','','epilogue'); ending.append(node('h4',ja.epilogueTitle),node('p',ja.epilogueText),node('p',ja.epilogueContinue,'muted'));
  chronicle.append(node('h3',ja.chronicleTitle),node('p',ja.chronicleIntro),goals,read,ending);
  panel.append(node('h2',ja.mailTitle),node('p',ja.mailIntro),node('p',ja.mailRules),node('p',ja.mailUnlock,'small muted'),
    tickets,fee,wallet,start,stage,clue,status,progress,choices,result,record,node('p',ja.mailResetHint,'small muted'),collection,chronicle);
  function render() {
    const m=state.mail,r=m.round; setHidden(panel,state.myth.count < b.mythUnlock);
    updateText(tickets,ja.mailTickets(m.tickets,Math.ceil(b.rechargeSeconds-m.recharge)));
    updateText(fee,ja.mailFee(formatNumber(mailCost(state),state.format)));
    updateText(wallet,`${ja.statsBalance}：${formatNumber(state.currency,state.format)}${ja.currency}`);
    setHidden(start,!!r); start.disabled=!mailAvailable(state)||m.tickets<1||state.currency.lt(mailCost(state));
    setHidden(stage,!r); setHidden(clue,!r); setHidden(choices,!r); setHidden(progress,r?.phase!=='running');
    if(r) {
      updateText(stage,ja.mailStage(r.stage+1)); updateText(clue,ja.mailClues[r.destinations[r.stage]][r.variants[r.stage]]);
      updateText(status,r.phase==='running'?ja.mailWaiting(Math.ceil(r.remaining)):ja.mailChoose);
      buttons.forEach(button=>{button.disabled=r.phase!=='ready';});
      const value=b.stageSeconds-r.remaining; if(progress.value!==value)progress.value=value;
    } else updateText(status,'');
    updateText(result,!r&&m.completed>0?ja.mailResult(m.lastCorrect):'');
    updateText(record,ja.mailRecord(m.plays,m.completed,m.deliveries)); updateText(count,ja.postcardCount(m.postcards.length));
    cards.forEach(({card,art,title,text},i)=> {
      const owned=m.postcards.includes(b.postcards[i]); card.classList.toggle('collected',owned); setHidden(art,!owned);
      updateText(title,owned?ja.postcardNames[i]:ja.postcardUnknown); updateText(text,owned?ja.postcardTexts[i]:'');
    });
    chronicleProgress(state).forEach((done,i)=>updateText(rows[i],ja.chronicleCheck(done,ja.chronicleGoals[i])));
    read.disabled=!canReadEpilogue(state); setHidden(read,m.epilogueSeen); setHidden(ending,!m.epilogueSeen);
  }
  return {panel,render};
}
