import Decimal from 'break_eternity.js';
import { describe,expect,it } from 'vitest';
import { createState } from '../src/state/game';
import { production } from '../src/systems/economy';
import { serialize } from '../src/save/codec';
import { publicGameUrl,shareRecord,tweetUrl } from '../src/ui/share-data';
import { formatNumber } from '../src/ui/format';

describe('共有する記録',()=>{
  it('表示中の所持伝聞と毎秒生産を使い、ゲームの状態を変えない',()=>{
    const state=createState(0); state.currency=new Decimal('123456789'); state.owned[0]=10;
    const before=serialize(state), record=shareRecord(state,'https://example.com/renamed/');
    expect(record.amount).toBe(formatNumber(state.currency,state.format));
    expect(record.rate).toBe(formatNumber(production(state),state.format));
    expect(record.text).toContain(record.amount); expect(record.text).toContain(record.rate);
    expect(record.text).toContain('いまの伝聞'); expect(serialize(state)).toBe(before);
    state.currency=new Decimal(0); expect(record.amount).not.toBe('0');
  });
  it('公開パスを保ち、クエリーとフラグメントを共有しない',()=>{
    expect(publicGameUrl('https://example.com/renamed/index.html?token=secret#save')).toBe('https://example.com/renamed/');
    expect(publicGameUrl('https://example.com/another-name/')).toBe('https://example.com/another-name/');
  });
  it('ローカル試遊・認証情報付きURL・不正スキームを共有しない',()=>{
    for(const url of ['http://127.0.0.1:4173/','http://localhost:4174/','http://demo.local/','http://192.168.1.2/',
      'http://10.1.2.3/','http://172.16.0.3/','http://[::1]/','https://user:password@example.com/', 'javascript:alert(1)','invalid']) {
      expect(publicGameUrl(url)).toBeUndefined();
    }
  });
  it('巨大数も現在の数値表記で共有でき、改造印は文章にも含める',()=>{
    const state=createState(0); state.currency=new Decimal('1e500'); state.format='scientific'; state.tainted=true;
    const record=shareRecord(state,'http://localhost/'); expect(record.text).toContain('1e500');
    expect(record.text).toContain('改造データ'); expect(record.url).toBeUndefined();
    expect(new URL(tweetUrl(record)).searchParams.has('url')).toBe(false);
  });
  it('Xの投稿画面用URLへ日本語と特殊文字を正しく符号化する',()=>{
    const record={text:'伝聞＋100 & 200\n#うわさの育て方',url:'https://example.com/play/'};
    const intent=new URL(tweetUrl(record)); expect(intent.origin).toBe('https://x.com');
    expect(intent.pathname).toBe('/intent/tweet'); expect(intent.searchParams.get('text')).toBe(record.text);
    expect(intent.searchParams.get('url')).toBe(record.url);
  });
});
