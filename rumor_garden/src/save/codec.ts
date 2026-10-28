import { GAME_ID, MAX_SAVE_SIZE, SAVE_VERSION } from '../config';
import type { GameState } from '../state/game';
import { grantAchievements } from '../systems/achievements';
import { compress, decompress } from './compression';
import { equalSignature, fromBase64Url, signature, toBase64Url } from './crypto';
import { isRecord, migrateV1, migrateV2, migrateV3, migrateV4, migrateV5, migrateV6, migrateV7, UnsupportedSaveError } from './migrations';
import { inconsistent } from './validation';
import { parseState, serialize } from './state-format';
export { serialize } from './state-format';

export async function encodeSnapshot(json: string): Promise<string> {
  const body = toBase64Url(await compress(json));
  const message = `${GAME_ID}|v${SAVE_VERSION}|${body}`;
  return `${message}|${toBase64Url(await signature(message))}`;
}
export async function encode(state: GameState): Promise<string> { return encodeSnapshot(serialize(state)); }

export interface DecodedSave { state: GameState; legacy: boolean; signatureValid: boolean }
export async function inspect(raw: string, now = Date.now(), source: 'local' | 'import' = 'import'): Promise<DecodedSave> {
  const text = raw.trim();
  if (!text || text.length > MAX_SAVE_SIZE) throw new Error('Invalid save size');
  let data: unknown;
  let legacy = false, signatureValid = false, version = SAVE_VERSION;
  if (text.startsWith('{')) {
    const old: unknown = JSON.parse(text);
    if (!isRecord(old)) throw new Error('Invalid legacy save');
    data = migrateV1(old); version = 2; legacy = true;
  } else {
    const parts = text.split('|');
    if (parts.length !== 4 || parts[0] !== GAME_ID) throw new Error('Unsupported save envelope');
    if (!['v2', 'v3', 'v4', 'v5', 'v6', 'v7', `v${SAVE_VERSION}`].includes(parts[1])) throw new UnsupportedSaveError('Unsupported schema');
    version = Number(parts[1].slice(1));
    const supplied = fromBase64Url(parts[3]);
    if (supplied.length !== 16) throw new Error('Invalid signature length');
    signatureValid = equalSignature(await signature(parts.slice(0, 3).join('|')), supplied);
    data = JSON.parse(await decompress(fromBase64Url(parts[2])));
    if (!isRecord(data) || data.version !== version) throw new Error('Schema mismatch');
  }
  if (version === 2) {
    if (!isRecord(data)) throw new Error('Invalid old save');
    data = migrateV2(data);
    version = 3;
  }
  if (version === 3) {
    if (!isRecord(data)) throw new Error('Invalid v3 save');
    data = migrateV3(data);
    version = 4;
  }
  if (version === 4) {
    if (!isRecord(data)) throw new Error('Invalid v4 save');
    data = migrateV4(data);
    version = 5;
  }
  if (version === 5) {
    if (!isRecord(data)) throw new Error('Invalid v5 save');
    data = migrateV5(data);
    version = 6;
  }
  if (version === 6) {
    if (!isRecord(data)) throw new Error('Invalid v6 save');
    data = migrateV6(data);
    version = 7;
  }
  if (version === 7) {
    if (!isRecord(data)) throw new Error('Invalid v7 save');
    data = migrateV7(data);
  }
  const state = parseState(data);
  state.tainted ||= (!legacy && !signatureValid) || (legacy && source === 'import') || inconsistent(state, now);
  // Newly introduced achievements can be derived from the old monotonic records.
  grantAchievements(state);
  return { state, legacy, signatureValid };
}
export async function decode(raw: string, now = Date.now(), source: 'local' | 'import' = 'import'): Promise<GameState> {
  return (await inspect(raw, now, source)).state;
}
