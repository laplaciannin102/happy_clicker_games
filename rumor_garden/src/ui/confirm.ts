import { ja } from '../i18n/ja';

// Each question requires a distinct user action; Escape and the default focus cancel.
export function confirmAction(text: string): Promise<boolean> {
  const previousFocus = document.activeElement;
  const dialog = document.createElement('dialog');
  const title = document.createElement('h2');
  title.id = 'save-confirm-title'; title.textContent = ja.confirmTitle;
  dialog.setAttribute('aria-labelledby', title.id);
  const message = document.createElement('p'); message.textContent = text;
  const form = document.createElement('form'); form.method = 'dialog';
  const cancel = document.createElement('button');
  cancel.value = 'cancel'; cancel.textContent = ja.confirmCancel; cancel.autofocus = true;
  const accept = document.createElement('button');
  accept.value = 'accept'; accept.textContent = ja.confirmContinue;
  form.append(cancel, accept); dialog.append(title, message, form); document.body.append(dialog);
  return new Promise(resolve => {
    dialog.addEventListener('close', () => {
      const confirmed = dialog.returnValue === 'accept';
      dialog.remove();
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
      resolve(confirmed);
    }, { once: true });
    dialog.showModal();
  });
}
