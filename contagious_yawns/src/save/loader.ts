import type { GameState } from '../state/gameState';
import { decodeSave, type DecodeError, type DecodeOptions, type SignatureStatus } from './codec';
import { checkIntegrity, type IntegrityIssue } from './integrity';

export interface LoadedSave {
  state: GameState;
  signature: SignatureStatus;
  issues: IntegrityIssue[];
  fromVersion: number;
}

export type TextLoadResult = { ok: true; value: LoadedSave } | { ok: false; error: DecodeError };

/**
 * セーブ文字列を読み、署名と整合性を確かめる。
 * 改造の疑いがあっても読み込みは許し、tainted を立てる（SPEC §6.3-3）。
 */
export async function loadFromText(
  text: string,
  now: number,
  options: DecodeOptions,
): Promise<TextLoadResult> {
  const result = await decodeSave(text, options);
  if (!result.ok) return result;
  const { state, signature, fromVersion } = result.value;
  const issues = checkIntegrity(state, now);
  if (signature === 'invalid' || issues.length > 0) state.tainted = true;
  return { ok: true, value: { state, signature, issues, fromVersion } };
}
