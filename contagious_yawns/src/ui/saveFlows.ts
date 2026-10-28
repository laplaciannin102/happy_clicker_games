import { ja, t } from '../i18n/ja';
import type { LoadedSave } from '../save/loader';
import { el } from './dom';
import { confirmDialog } from './dialog';
import { formatDuration, formatNumber } from './format';

/** インポート前の確認。中身の要約と、改造の疑いがあればその理由を見せる（SPEC §6.1）。 */
export function confirmImport(loaded: LoadedSave): Promise<boolean> {
  const { state, signature, issues } = loaded;
  const notation = state.settings.notation;

  const summary = el('ul', 'import-summary');
  summary.append(
    el('li', '', t(ja.importSummaryYawns, { n: formatNumber(state.yawns, notation) })),
    el('li', '', t(ja.importSummaryTotal, { n: formatNumber(state.totalYawns, notation) })),
    el('li', '', t(ja.importSummaryPlayTime, { t: formatDuration(state.playTimeMs / 1000) })),
    el('li', '', t(ja.importSummarySavedAt, { d: new Date(state.lastSavedAt).toLocaleString('ja-JP') })),
  );

  const body: (string | HTMLElement)[] = [ja.importConfirmBody, summary];
  const warnings: string[] = [];
  if (signature === 'invalid') warnings.push(ja.importWarnSignature);
  if (issues.length > 0) {
    warnings.push(t(ja.importWarnIntegrity, { list: issues.map((i) => ja.integrityIssue[i]).join('、') }));
  }
  if (state.tainted) warnings.push(ja.importWarnTainted);
  for (const w of warnings) body.push(el('p', 'warning', `⚠ ${w}`));

  return confirmDialog({
    title: ja.importConfirmTitle,
    body,
    confirmLabel: ja.importConfirm,
    danger: warnings.length > 0,
  });
}

/** おやすみの確認。何が消えて何が残るかを見せる。 */
export function confirmPrestige(gain: number): Promise<boolean> {
  return confirmDialog({
    title: ja.dream.confirmTitle,
    body: [t(ja.dream.confirmGain, { n: gain.toLocaleString('ja-JP') }), ja.dream.confirmReset, ja.dream.confirmKeep],
    confirmLabel: ja.dream.confirmButton,
  });
}

/** 冬眠の確認。何が消えて何が残るか、次の季節を見せる。 */
export function confirmHibernate(gain: number, season: string, nextNeed: number): Promise<boolean> {
  const body = [t(ja.hibernation.confirmGain, { n: gain, s: season }), ja.hibernation.confirmReset, ja.hibernation.confirmKeep];
  if (gain === 0) body.push(t(ja.hibernation.confirmZero, { need: nextNeed.toLocaleString('ja-JP') }));
  return confirmDialog({ title: ja.hibernation.confirmTitle, body, confirmLabel: ja.hibernation.confirmButton, danger: gain === 0 });
}

/** チャレンジを始める確認（今の周回がリセットされる）。 */
export function confirmChallenge(name: string): Promise<boolean> {
  return confirmDialog({
    title: t(ja.challenge.confirmTitle, { name }),
    body: [ja.challenge.confirmBody],
    confirmLabel: ja.challenge.confirmButton,
    danger: true,
  });
}

/** ハードリセットの二重確認（SPEC §6.1）。 */
export async function confirmHardReset(): Promise<boolean> {
  const first = await confirmDialog({
    title: ja.resetConfirm1Title,
    body: [ja.resetConfirm1Body],
    confirmLabel: ja.resetConfirm1,
    danger: true,
  });
  if (!first) return false;
  return confirmDialog({
    title: ja.resetConfirm2Title,
    body: [ja.resetConfirm2Body],
    confirmLabel: ja.resetConfirm2,
    danger: true,
  });
}
