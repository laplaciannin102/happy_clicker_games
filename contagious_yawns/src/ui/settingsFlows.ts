import { createSeed } from '../core/rng';
import { ja } from '../i18n/ja';
import { encodeSave } from '../save/codec';
import { exportFileName } from '../save/fileName';
import { loadFromText } from '../save/loader';
import { createInitialState, type GameState } from '../state/gameState';
import { copyText, downloadText } from './fileIO';
import { confirmHardReset, confirmImport } from './saveFlows';
import { createSettingsDialog, type SettingsDialog } from './settingsDialog';
import type { SoundPlayer } from './sound';
import type { Toaster } from './toast';

export interface SettingsContext {
  getState(): GameState;
  /** 状態を丸ごと入れ替える（インポート・ハードリセット）。設定の反映と描画もする */
  setState(state: GameState): void;
  render(): void;
  save(): Promise<boolean>;
  /** セーブをすべて消して、この状態だけを保存し直す */
  resetStorage(fresh: GameState): Promise<void>;
  /** テーマ・演出・音量・自動セーブ間隔を反映する */
  applySettings(): void;
  toaster: Toaster;
  sound: SoundPlayer;
}

/** 設定画面の操作（表示・音・セーブデータ）。 */
export function createSettingsFlows(ctx: SettingsContext): SettingsDialog {
  const { toaster } = ctx;
  const dialog = createSettingsDialog({
    onNotation(notation) {
      ctx.getState().settings.notation = notation;
      ctx.render();
    },
    onDisplay(patch) {
      Object.assign(ctx.getState().settings, patch);
      ctx.applySettings();
      // 音量を変えたら、その大きさで1回鳴らして聞かせる
      if (patch.volume !== undefined) ctx.sound.play('achievement');
      ctx.render();
    },
    exportText: () => encodeSave(ctx.getState()),
    onDownload(text) {
      downloadText(text, exportFileName(new Date()));
    },
    onCopy(text, field) {
      void copyText(text, field).then((ok) => toaster.show(ok ? ja.copied : ja.copyFailed, ok ? 'info' : 'warn'));
    },
    async onImport(text) {
      if (!text.trim()) {
        toaster.show(ja.importEmpty, 'warn');
        return false;
      }
      const result = await loadFromText(text, Date.now(), { allowLegacyJson: false });
      if (!result.ok) {
        toaster.show(ja.importError[result.error], 'warn');
        return false;
      }
      if (!(await confirmImport(result.value))) return false;
      ctx.setState(result.value.state);
      await ctx.save();
      toaster.show(ja.imported);
      return true;
    },
    async onHardReset() {
      if (!(await confirmHardReset())) return;
      const fresh = createInitialState(Date.now(), createSeed());
      ctx.setState(fresh);
      await ctx.resetStorage(fresh);
      dialog.close();
      toaster.show(ja.resetDone);
    },
  });
  return dialog;
}
