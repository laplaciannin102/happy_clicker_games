import { el } from './dom';

const TOAST_MS = 3_000;
const MAX_TOASTS = 3;

/** special：実績・チャレンジのクリアなど、うれしい知らせ */
export type ToastKind = 'info' | 'warn' | 'special';

export interface Toaster {
  readonly root: HTMLElement;
  show(message: string, kind?: ToastKind): void;
}

/** 画面下の通知（SPEC §7）。 */
export function createToaster(): Toaster {
  const root = el('div', 'toasts');
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');

  return {
    root,
    show(message, kind = 'info') {
      if (root.childElementCount >= MAX_TOASTS) root.firstElementChild?.remove();
      const toast = el('div', `toast toast-${kind}`, message);
      root.append(toast);
      window.setTimeout(() => toast.remove(), kind === 'warn' ? TOAST_MS * 3 : TOAST_MS);
    },
  };
}
