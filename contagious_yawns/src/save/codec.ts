import { GAME_ID } from '../config';
import { SCHEMA_VERSION, type GameState } from '../state/gameState';
import { base64UrlToUtf8, utf8ToBase64Url } from './base64url';
import { migrate } from './migrations';
import { fromPayload, isRecord, toPayload } from './payload';
import { sign, verify } from './signing';

/**
 * セーブ文字列（SPEC §6.2、ただし圧縮なし＝DESIGN.md §13）：
 *   <ゲームID>|v<スキーマ版>|<本体：JSON の UTF-8 を Base64URL>|<署名>
 * 署名つきの形式は v2 から。v1 は Phase 1 の素の JSON。
 * 署名は「ゲームID|版|本体」全体にかけるので、版番号だけの書き換えも検出できる。
 */
const SEPARATOR = '|';

/** Phase 1 の素の JSON（署名なし）の版 */
const LEGACY_JSON_VERSION = 1;

export type SignatureStatus = 'valid' | 'invalid' | 'legacy';

export interface Decoded {
  state: GameState;
  signature: SignatureStatus;
  /** 読み込んだときの版（マイグレーション前） */
  fromVersion: number;
}

export type DecodeError = 'format' | 'otherGame' | 'newerVersion' | 'body';

export type DecodeResult = { ok: true; value: Decoded } | { ok: false; error: DecodeError };

export async function encodeSave(state: GameState): Promise<string> {
  // 状態のスナップショットは await の前に取る（署名中に状態が進んでもずれない）
  const body = utf8ToBase64Url(JSON.stringify(toPayload(state)));
  const head = [GAME_ID, `v${SCHEMA_VERSION}`, body].join(SEPARATOR);
  return `${head}${SEPARATOR}${await sign(head)}`;
}

function finish(raw: Record<string, unknown>, from: number, signature: SignatureStatus): DecodeResult {
  const migrated = migrate(raw, from);
  const state = migrated ? fromPayload(migrated) : null;
  return state ? { ok: true, value: { state, signature, fromVersion: from } } : { ok: false, error: 'body' };
}

export interface DecodeOptions {
  /** Phase 1 の素の JSON を受け付けるか。署名がないので、自分の localStorage からだけ許す */
  allowLegacyJson: boolean;
}

export async function decodeSave(input: string, options: DecodeOptions): Promise<DecodeResult> {
  const text = input.trim();

  if (text.startsWith('{')) {
    if (!options.allowLegacyJson) return { ok: false, error: 'format' };
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return { ok: false, error: 'format' };
    }
    if (!isRecord(raw) || raw.v !== LEGACY_JSON_VERSION) return { ok: false, error: 'format' };
    return finish(raw, LEGACY_JSON_VERSION, 'legacy');
  }

  const parts = text.split(SEPARATOR);
  if (parts.length !== 4) return { ok: false, error: 'format' };
  const [game, versionTag, body, signature] = parts as [string, string, string, string];
  if (game !== GAME_ID) return { ok: false, error: 'otherGame' };
  const match = /^v(\d{1,6})$/.exec(versionTag);
  if (!match?.[1]) return { ok: false, error: 'format' };
  const version = Number(match[1]);
  if (version > SCHEMA_VERSION) return { ok: false, error: 'newerVersion' };
  if (version < 2) return { ok: false, error: 'format' };

  const json = base64UrlToUtf8(body);
  if (json === null) return { ok: false, error: 'body' };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'body' };
  }
  if (!isRecord(raw)) return { ok: false, error: 'body' };

  const head = [game, versionTag, body].join(SEPARATOR);
  const valid = await verify(head, signature);
  return finish(raw, version, valid ? 'valid' : 'invalid');
}
