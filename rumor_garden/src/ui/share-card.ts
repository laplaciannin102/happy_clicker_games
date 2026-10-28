import { ja } from '../i18n/ja';
import { GAME_ID } from '../config';
import type { ShareRecord } from './share-data';

// Draw the record directly: no screen capture permission or external renderer.
export async function createShareCard(record: ShareRecord): Promise<File> {
  const canvas = document.createElement('canvas'); canvas.width=1200; canvas.height=630;
  const ctx=canvas.getContext('2d'); if(!ctx)throw new Error('Canvas unavailable');
  const font="'Yu Gothic','Hiragino Kaku Gothic ProN',sans-serif";
  const text=(value:string,x:number,y:number,size:number,color:string,max=1050)=> {
    let fitted=size; ctx.font=`700 ${fitted}px ${font}`;
    while(ctx.measureText(value).width>max&&fitted>20) { fitted-=2; ctx.font=`700 ${fitted}px ${font}`; }
    ctx.fillStyle=color; ctx.fillText(value,x,y);
  };
  ctx.fillStyle='#101d2d'; ctx.fillRect(0,0,1200,630);
  ctx.strokeStyle='#edc383'; ctx.lineWidth=3; ctx.strokeRect(28,28,1144,574);
  text(ja.title,64,100,46,'#edc383'); text(ja.recordCardTitle,64,150,22,'#c0cddd');
  text(ja.shareAmount,64,230,26,'#c0cddd'); text(record.amount,64,330,86,'#fff4df',900);
  text(ja.currency,990,330,30,'#edc383',130);
  text(ja.shareRate(record.rate),64,403,32,'#edc383');
  text(ja.shareProgress(record.legends,record.myths),64,466,24,'#c0cddd');
  if(record.tainted)text(ja.tainted,64,520,22,'#ffd2c6');
  text(ja.creditShort,64,568,19,'#c0cddd');
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('PNG unavailable')),'image/png'));
  return new File([blob],`${GAME_ID}_record.png`,{type:'image/png'});
}
