import { CREDITS } from '../data/credits';
import { ja, t } from '../i18n/ja';
import type { GameState } from '../state/gameState';
import { currentSeason } from '../systems/hibernation';
import { totalRate } from '../systems/production';
import { formatNumber } from './format';

/** 共有する文：今の手持ちと毎秒（DOM に触らないのでテストできる）。 */
export function shareText(state: GameState): string {
  const s = ja.share;
  const notation = state.settings.notation;
  const parts = [t(s.text, { n: formatNumber(state.yawns, notation), r: formatNumber(totalRate(state), notation) })];
  const season = currentSeason(state);
  if (season) parts.push(t(s.textHibernate, { c: state.hibernation.count, season: ja.hibernation.seasons[season].name }));
  if (state.awakenedAt !== null) parts.push(s.textAwakened);
  return `${parts.join(' ')}\n#${CREDITS.hashtag}`;
}

/** 共有にのせるゲームの URL。http(s) で開いているときだけ（ファイルとして開いたときは出さない）。 */
export function shareUrl(href: string): string | null {
  try {
    const u = new URL(href);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hash = '';
    u.search = '';
    return u.toString();
  } catch {
    return null;
  }
}

/** 𝕏 の投稿画面の URL（文と URL を入れておく。画像は仕組み上ここからは添付できない）。 */
export function postIntentUrl(text: string, url: string | null): string {
  const params = new URLSearchParams({ text });
  if (url) params.set('url', url);
  return `https://x.com/intent/post?${params.toString()}`;
}
