import { ja } from '../i18n/ja';
import { el } from './dom';

export interface ConfirmOptions {
  title: string;
  body: readonly (string | HTMLElement)[];
  confirmLabel: string;
  /** 取り消せない操作。「やめる」に初期フォーカスを置き、確定ボタンを警告色にする */
  danger?: boolean;
}

/** お知らせ（ボタン1つ）。閉じたら解決する。 */
export function noticeDialog(title: string, body: readonly string[], okLabel: string): Promise<void> {
  const dialog = el('dialog', 'dialog confirm-dialog');
  const form = el('form');
  form.method = 'dialog';
  const content = el('div', 'dialog-body');
  for (const line of body) content.append(el('p', '', line));
  const actions = el('div', 'dialog-actions');
  const ok = el('button', 'button button-primary', okLabel);
  ok.value = 'ok';
  actions.append(ok);
  form.append(el('h2', 'dialog-title', title), content, actions);
  dialog.append(form);
  document.body.append(dialog);
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve();
    });
    dialog.showModal();
    ok.focus();
  });
}

/** 確認ダイアログ。確定なら true。 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  const dialog = el('dialog', 'dialog confirm-dialog');
  const form = el('form');
  form.method = 'dialog';

  const heading = el('h2', 'dialog-title', options.title);
  const content = el('div', 'dialog-body');
  for (const part of options.body) content.append(typeof part === 'string' ? el('p', '', part) : part);

  const actions = el('div', 'dialog-actions');
  const cancel = el('button', 'button', ja.cancel);
  cancel.value = 'cancel';
  const confirm = el('button', options.danger ? 'button button-danger' : 'button button-primary', options.confirmLabel);
  confirm.value = 'confirm';
  actions.append(cancel, confirm);
  form.append(heading, content, actions);
  dialog.append(form);
  document.body.append(dialog);

  return new Promise((resolve) => {
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'confirm');
      dialog.remove();
    });
    dialog.showModal();
    (options.danger ? cancel : confirm).focus();
  });
}
