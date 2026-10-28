import { ja } from '../i18n/ja';
import type { GameState } from '../state/game';
import { production } from '../systems/economy';
import { formatNumber } from './format';

export interface ShareRecord {
  amount: string; rate: string; legends: string; myths: string; tainted: boolean;
  text: string; url?: string;
}
export function publicGameUrl(address: string): string | undefined {
  try {
    const url = new URL(address), host = url.hostname.toLowerCase();
    if (!['http:','https:'].includes(url.protocol) || url.username || url.password ||
      host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
      host === '[::1]' || host.startsWith('[fe80:') || host.startsWith('[fc') || host.startsWith('[fd') ||
      /^127\.|^10\.|^192\.168\.|^169\.254\.|^0\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return undefined;
    // Keep the deployed directory; never forward query parameters or fragments.
    return new URL('.',url).href;
  } catch { return undefined; }
}
export function shareRecord(state: GameState, address: string): ShareRecord {
  const amount = formatNumber(state.currency,state.format), rate = formatNumber(production(state),state.format);
  return { amount,rate,legends:String(state.prestige.count),myths:String(state.myth.count),tainted:state.tainted,
    text:ja.shareText(amount,rate,state.tainted),url:publicGameUrl(address) };
}
export function tweetUrl(record: Pick<ShareRecord,'text'|'url'>): string {
  const url = new URL('https://x.com/intent/tweet'); url.searchParams.set('text',record.text);
  if(record.url)url.searchParams.set('url',record.url);
  return url.href;
}
