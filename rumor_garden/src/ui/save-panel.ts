import { MAX_SAVE_SIZE } from '../config';
import { ja } from '../i18n/ja';
import { saveFilename, type SaveActions } from '../save/actions';

function node<K extends keyof HTMLElementTagNameMap>(tag: K, text = '') {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
}

export function createSavePanel(actions: SaveActions, notify: (text: string) => void) {
  const panel = node('section');
  panel.className = 'save-panel';
  const textLabel = node('label', ja.saveText);
  const textarea = node('textarea');
  textarea.rows = 5;
  textarea.maxLength = MAX_SAVE_SIZE;
  textarea.spellcheck = false;
  textLabel.append(textarea);
  const buttons = node('div');
  buttons.className = 'save-buttons';
  const controls: Array<HTMLButtonElement | HTMLInputElement> = [];
  async function run(work: () => Promise<void>) {
    const previousFocus = document.activeElement;
    controls.forEach(button => { button.disabled = true; });
    try { await work(); } catch { notify(ja.saveFailed); }
    finally {
      controls.forEach(button => { button.disabled = false; });
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    }
  }
  function button(text: string, work: () => Promise<void>) {
    const element = node('button', text);
    element.type = 'button';
    element.addEventListener('click', () => { void run(work); });
    controls.push(element);
    buttons.append(element);
    return element;
  }
  button(ja.exportText, async () => { textarea.value = await actions.exportText(); notify(ja.exported); });
  button(ja.copy, async () => {
    if (!textarea.value) textarea.value = await actions.exportText();
    try { await navigator.clipboard.writeText(textarea.value); notify(ja.copied); }
    catch { textarea.focus(); textarea.select(); notify(ja.copyFailed); }
  });
  button(ja.exportFile, async () => {
    textarea.value = await actions.exportText();
    const url = URL.createObjectURL(new Blob([textarea.value], { type: 'text/plain;charset=utf-8' }));
    const link = node('a');
    link.href = url; link.download = saveFilename();
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(ja.exported);
  });
  button(ja.importText, () => actions.importText(textarea.value));
  const fileLabel = node('label', ja.importFile);
  const file = node('input');
  file.type = 'file'; file.accept = '.txt,text/plain';
  controls.push(file);
  file.addEventListener('change', () => {
    const selected = file.files?.[0];
    if (!selected) return;
    void run(async () => {
      if (selected.size > MAX_SAVE_SIZE) { notify(ja.invalidSave); return; }
      textarea.value = await selected.text();
      await actions.importText(textarea.value);
    }).finally(() => { file.value = ''; });
  });
  fileLabel.append(file);
  const backupLabel = node('label', ja.backupLabel);
  const backups = node('select');
  ja.backupOptions.forEach((text, index) => {
    const option = node('option', text); option.value = String(index); backups.append(option);
  });
  backupLabel.append(backups);
  const restore = button(ja.restore, () => actions.restore(Number(backups.value)));
  const reset = button(ja.reset, () => actions.reset());
  reset.className = 'danger';
  const restoreRow = node('div');
  restoreRow.append(backupLabel, restore, reset);
  panel.append(node('h3', ja.dataManagement), node('p', ja.saveTextHint), textLabel, buttons,
    fileLabel, restoreRow, node('p', ja.legacyHint), node('p', ja.snapshotHint));
  return panel;
}
