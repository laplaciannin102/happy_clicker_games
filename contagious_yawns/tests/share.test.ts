import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { CREDITS } from '../src/data/credits';
import { createInitialState } from '../src/state/gameState';
import { postIntentUrl, shareText, shareUrl } from '../src/ui/shareText';

describe('共有の文', () => {
  it('今の手持ちとハッシュタグが入る。冬眠のあとは季節、めざめたあとは朝も', () => {
    const s = createInitialState(0, 1);
    s.yawns = new Decimal(12_345);
    expect(shareText(s)).toContain('1.234万');
    expect(shareText(s)).toContain(`#${CREDITS.hashtag}`);
    s.hibernation.count = 1;
    expect(shareText(s)).toContain('春');
    s.awakenedAt = 1;
    expect(shareText(s)).toContain('朝がきた');
  });

  it('URL は http(s) のときだけ、クエリとハッシュを外してのせる', () => {
    expect(shareUrl('https://example.com/game/?debug=1#x')).toBe('https://example.com/game/');
    expect(shareUrl('file:///C:/game/index.html')).toBeNull();
    expect(shareUrl('not a url')).toBeNull();
  });

  it('𝕏 の投稿画面の URL に文と URL が入る', () => {
    const u = new URL(postIntentUrl('あくび #タグ', 'https://example.com/'));
    expect(u.origin + u.pathname).toBe('https://x.com/intent/post');
    expect(u.searchParams.get('text')).toBe('あくび #タグ');
    expect(u.searchParams.get('url')).toBe('https://example.com/');
    expect(new URL(postIntentUrl('a', null)).searchParams.has('url')).toBe(false);
  });
});
