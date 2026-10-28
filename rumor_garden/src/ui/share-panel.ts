import { ja } from '../i18n/ja';
import type { GameState } from '../state/game';
import { node, updateText } from './dom';
import { shareRecord, tweetUrl, type ShareRecord } from './share-data';
import { createShareCard } from './share-card';

export function createSharePanel(state: GameState) {
  const controls=node('div','','share-controls'), open=node('button',ja.shareButton), tweet=node('a',ja.tweetButton,'button-link');
  open.type='button'; tweet.target='_blank'; tweet.rel='noopener noreferrer'; controls.append(open,tweet);
  const dialog=node('dialog','','share-dialog'); dialog.setAttribute('aria-labelledby','share-title');
  const title=node('h2',ja.shareTitle); title.id='share-title';
  const label=node('label',ja.sharePreview), input=node('textarea'); input.readOnly=true; input.rows=4; label.append(input);
  const image=node('img','','share-card-preview'); image.alt=ja.cardAlt; image.hidden=true;
  const status=node('p','','small muted'); status.setAttribute('role','status');
  const actions=node('div','','share-actions'), native=node('button',ja.nativeShare), copy=node('button',ja.copyShare), download=node('button',ja.downloadCard);
  const x=node('a',ja.tweetButton,'button-link'); x.target='_blank'; x.rel='noopener noreferrer';
  const close=node('button',ja.closeShare); close.type='button';
  [native,copy,download].forEach(button=>{button.type='button';}); actions.append(native,copy,download,x);
  const heading=node('div','','share-dialog-heading'); heading.append(title,close);
  dialog.append(heading,node('p',ja.shareHint),label,image,status,actions,node('p',ja.xImageHint,'small muted'));
  document.body.append(dialog);
  let record: ShareRecord | undefined, file:File|undefined, imageUrl:string|undefined, epoch=0, previous:Element|null=null;
  function clean() { epoch++; file=undefined; if(imageUrl)URL.revokeObjectURL(imageUrl); imageUrl=undefined; image.removeAttribute('src'); image.hidden=true; }
  function render() {
    const value=tweetUrl(shareRecord(state,location.href)); if(tweet.href!==value)tweet.href=value;
  }
  open.addEventListener('click',()=> {
    if(dialog.open)return; clean(); previous=document.activeElement; record=shareRecord(state,location.href);
    input.value=[record.text,record.url].filter(Boolean).join('\n'); x.href=tweetUrl(record);
    native.hidden=typeof navigator.share!=='function'; native.disabled=true; download.disabled=true;
    updateText(status,ja.cardPreparing); dialog.showModal(); close.focus();
    const request=epoch;
    void createShareCard(record).then(result=> {
      if(request!==epoch||!dialog.open)return; file=result; imageUrl=URL.createObjectURL(result); image.src=imageUrl; image.hidden=false;
      native.disabled=false; download.disabled=false;
      updateText(status,record?.url?ja.cardReady:ja.cardReadyLocal);
    }).catch(()=> { if(request===epoch&&dialog.open) { native.disabled=false; updateText(status,ja.cardFailed); } });
  });
  copy.addEventListener('click',()=> {
    void navigator.clipboard?.writeText(input.value).then(()=>updateText(status,ja.copied)).catch(()=>{
      input.focus();input.select();updateText(status,ja.copyShareFallback);
    });
    if(!navigator.clipboard) {input.focus();input.select();updateText(status,ja.copyShareFallback);}
  });
  download.addEventListener('click',()=> {
    if(!file||!imageUrl)return;
    const a=node('a'); a.href=imageUrl; a.download=file.name; document.body.append(a); a.click(); a.remove();
    updateText(status,ja.cardSaved);
  });
  native.addEventListener('click',()=> {
    if(!record||typeof navigator.share!=='function')return;
    const data:ShareData={title:ja.title,text:record.text}; if(record.url)data.url=record.url;
    try {
      if(file&&navigator.canShare?.({...data,files:[file]}))data.files=[file];
      void navigator.share(data).then(()=>updateText(status,ja.shareDone)).catch(error=>{
        if(!(error instanceof DOMException&&error.name==='AbortError'))updateText(status,ja.shareFailed);
      });
    } catch { updateText(status,ja.shareFailed); }
  });
  close.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=> {clean(); if(previous instanceof HTMLElement)previous.focus();});
  render(); return {controls,render};
}
