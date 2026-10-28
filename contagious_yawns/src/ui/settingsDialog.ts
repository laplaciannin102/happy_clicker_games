import { ja, t } from '../i18n/ja';
import {
  AUTOSAVE_SECONDS,
  NOTATIONS,
  THEMES,
  VOLUME_STEP,
  type GameState,
  type Notation,
  type Settings,
} from '../state/gameState';
import { el, setHidden } from './dom';

/** 設定画面で変えられる、表示と音の設定 */
export type DisplaySettings = Pick<Settings, 'theme' | 'effects' | 'volume' | 'autosaveSec'>;

export interface SettingsHandlers {
  onNotation(notation: Notation): void;
  onDisplay(patch: Partial<DisplaySettings>): void;
  /** エクスポート用の文字列を作る */
  exportText(): Promise<string>;
  /** エクスポートをファイルとして保存する */
  onDownload(text: string): void;
  onCopy(text: string, field: HTMLTextAreaElement): void;
  /** 読み込み（確認ダイアログはこの中で出す）。読み込めたら true */
  onImport(text: string): Promise<boolean>;
  onHardReset(): Promise<void>;
}

export interface SettingsDialog {
  open(state: GameState): void;
  close(): void;
}

function section(title: string, ...children: HTMLElement[]): HTMLElement {
  const s = el('section', 'settings-section');
  s.append(el('h3', '', title), ...children);
  return s;
}

function selectField<T extends string | number>(
  label: string,
  values: readonly T[],
  text: (v: T) => string,
  onPick: (v: T) => void,
): { root: HTMLLabelElement; select: HTMLSelectElement } {
  const root = el('label', 'field');
  const select = el('select');
  for (const v of values) {
    const option = el('option', '', text(v));
    option.value = String(v);
    select.append(option);
  }
  select.addEventListener('change', () => {
    const picked = values.find((v) => String(v) === select.value);
    if (picked !== undefined) onPick(picked);
  });
  root.append(el('span', '', label), select);
  return { root, select };
}

function button(label: string, className = 'button'): HTMLButtonElement {
  const b = el('button', className, label);
  b.type = 'button';
  return b;
}

/** 設定画面：表示とセーブデータ（SPEC §6.1, §7）。 */
export function createSettingsDialog(handlers: SettingsHandlers): SettingsDialog {
  const dialog = el('dialog', 'dialog settings-dialog');
  dialog.setAttribute('aria-labelledby', 'settings-title');
  const header = el('div', 'dialog-header');
  const title = el('h2', 'dialog-title', ja.settings);
  title.id = 'settings-title';
  const close = button(ja.close);
  close.addEventListener('click', () => dialog.close());
  header.append(title, close);

  // 改造データの表示（統計画面ができるまではここに出す）
  const tainted = el('p', 'tainted-note', `⚠ ${ja.taintedBadge}：${ja.taintedHelp}`);

  // 表示
  const notation = selectField(ja.notationLabel, NOTATIONS, (n) => ja.notation[n], handlers.onNotation);
  const theme = selectField(ja.themeLabel, THEMES, (v) => ja.theme[v], (v) => handlers.onDisplay({ theme: v }));
  const autosave = selectField(
    ja.autosaveLabel,
    AUTOSAVE_SECONDS,
    (n) => t(ja.autosaveValue, { n }),
    (v) => handlers.onDisplay({ autosaveSec: v }),
  );

  // 音と演出
  const effectsLabel = el('label', 'field field-check');
  const effects = el('input');
  effects.type = 'checkbox';
  effects.addEventListener('change', () => handlers.onDisplay({ effects: effects.checked }));
  effectsLabel.append(effects, el('span', '', ja.effectsLabel));
  const volumeLabel = el('label', 'field');
  const volume = el('input');
  volume.type = 'range';
  volume.min = '0';
  volume.max = '100';
  volume.step = String(VOLUME_STEP);
  const volumeText = el('output', 'volume-value');
  const volumeName = (v: number): string => (v === 0 ? ja.volumeOff : t(ja.volumeValue, { n: v }));
  volume.addEventListener('input', () => {
    volumeText.textContent = volumeName(Number(volume.value));
  });
  // 動かし終わったときに1回だけ反映する（試しに鳴らす音が連続しないように）
  volume.addEventListener('change', () => handlers.onDisplay({ volume: Number(volume.value) }));
  volumeLabel.append(el('span', '', ja.volumeLabel), volume, volumeText);

  // エクスポート
  const exportField = el('textarea', 'save-text');
  exportField.readOnly = true;
  exportField.rows = 3;
  exportField.setAttribute('aria-label', ja.exportHeading);
  const copy = button(ja.copy);
  copy.addEventListener('click', () => handlers.onCopy(exportField.value, exportField));
  const download = button(ja.download);
  download.addEventListener('click', () => handlers.onDownload(exportField.value));
  const exportRow = el('div', 'button-row');
  exportRow.append(copy, download);

  // インポート
  const importField = el('textarea', 'save-text');
  importField.rows = 3;
  importField.placeholder = ja.importPlaceholder;
  importField.setAttribute('aria-label', ja.importHeading);
  const importButton = button(ja.importButton, 'button button-primary');
  importButton.addEventListener('click', () => {
    void handlers.onImport(importField.value).then((ok) => {
      if (ok) {
        importField.value = '';
        dialog.close();
      }
    });
  });
  const fileInput = el('input');
  fileInput.type = 'file';
  fileInput.accept = '.txt,text/plain';
  fileInput.hidden = true;
  const fileButton = button(ja.importFile);
  fileButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    void file.text().then(async (text) => {
      if (await handlers.onImport(text)) dialog.close();
    });
  });
  const importRow = el('div', 'button-row');
  importRow.append(importButton, fileButton, fileInput);

  // ハードリセット
  const reset = button(ja.resetButton, 'button button-danger');
  reset.addEventListener('click', () => {
    void handlers.onHardReset();
  });

  dialog.append(
    header,
    tainted,
    section(ja.displaySection, notation.root, theme.root, autosave.root),
    section(ja.soundSection, volumeLabel, effectsLabel, el('p', 'help', ja.effectsHelp)),
    section(
      ja.saveSection,
      el('h4', '', ja.exportHeading),
      el('p', 'help', ja.exportHelp),
      exportField,
      exportRow,
      el('h4', '', ja.importHeading),
      el('p', 'help', ja.importHelp),
      importField,
      importRow,
      el('h4', '', ja.resetHeading),
      el('p', 'help', ja.resetHelp),
      reset,
    ),
  );
  document.body.append(dialog);

  return {
    open(state) {
      const st = state.settings;
      notation.select.value = st.notation;
      theme.select.value = st.theme;
      autosave.select.value = String(st.autosaveSec);
      effects.checked = st.effects;
      volume.value = String(st.volume);
      volumeText.textContent = volumeName(st.volume);
      setHidden(tainted, !state.tainted);
      exportField.value = '';
      void handlers.exportText().then((text) => {
        exportField.value = text;
      });
      if (!dialog.open) dialog.showModal();
    },
    close() {
      if (dialog.open) dialog.close();
    },
  };
}
