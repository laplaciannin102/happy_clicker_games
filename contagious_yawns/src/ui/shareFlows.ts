import { ja } from '../i18n/ja';
import type { GameState } from '../state/gameState';
import { el } from './dom';
import { drawShareCard } from './shareCard';
import { postIntentUrl, shareText, shareUrl } from './shareText';
import type { createToaster } from './toast';

export interface ShareContext {
  getState(): GameState;
  toaster: ReturnType<typeof createToaster>;
}

const FILE_NAME = 'akubi-utsutta.png';

function download(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = el('a');
  a.href = url;
  a.download = FILE_NAME;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 共有ボタンの動き：𝕏 の投稿画面・端末の共有（画像つき）・画像の保存。 */
export function createShareFlows(ctx: ShareContext): { post(): void; share(): Promise<void>; saveImage(): Promise<void> } {
  const { toaster } = ctx;

  function post(): void {
    const url = postIntentUrl(shareText(ctx.getState()), shareUrl(location.href));
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  /** 端末の共有シート。画像を添えられる端末なら画像つき、できなければ文だけ、それもなければ文をコピー。 */
  async function share(): Promise<void> {
    const state = ctx.getState();
    const text = shareText(state);
    const url = shareUrl(location.href) ?? undefined;
    try {
      const blob = await drawShareCard(state);
      const files = blob ? [new File([blob], FILE_NAME, { type: 'image/png' })] : [];
      if (files.length > 0 && navigator.canShare?.({ files })) {
        await navigator.share({ text, ...(url ? { url } : {}), files });
        return;
      }
      if (typeof navigator.share === 'function') {
        await navigator.share({ text, ...(url ? { url } : {}) });
        return;
      }
      await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
      toaster.show(ja.share.copied);
    } catch (e) {
      // 共有シートを閉じただけなら何も言わない
      if (e instanceof DOMException && e.name === 'AbortError') return;
      toaster.show(ja.share.failed, 'warn');
    }
  }

  async function saveImage(): Promise<void> {
    const blob = await drawShareCard(ctx.getState());
    if (!blob) {
      toaster.show(ja.share.failed, 'warn');
      return;
    }
    download(blob);
    toaster.show(ja.share.saved);
  }

  return { post, share, saveImage };
}

/** メイン画面（ねどこ）の顔の下に置く、共有ボタンの列。 */
export function createShareBar(handlers: { onPost(): void; onShare(): void; onSaveImage(): void }): HTMLElement {
  const root = el('div', 'share-bar');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', ja.share.label);
  const buttons: [string, () => void][] = [
    [ja.share.post, handlers.onPost],
    [ja.share.native, handlers.onShare],
    [ja.share.image, handlers.onSaveImage],
  ];
  for (const [label, onClick] of buttons) {
    const b = el('button', 'button share-button', label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    root.append(b);
  }
  const hint = el('p', 'share-hint', ja.share.hint);
  const box = el('div', 'share-box');
  box.append(root, hint);
  return box;
}
