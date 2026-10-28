import { SAVE } from '../data/save';
import { bytesToBase64Url } from './base64url';
import { signingKeyBytes } from './keyMaterial';

let keyPromise: Promise<CryptoKey> | null = null;

function getKey(): Promise<CryptoKey> {
  keyPromise ??= crypto.subtle.importKey(
    'raw',
    signingKeyBytes(),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return keyPromise;
}

/** HMAC-SHA256 の先頭 SAVE.signatureBytes バイトを Base64URL で返す（SPEC §6.2）。 */
export async function sign(message: string): Promise<string> {
  const mac = await crypto.subtle.sign('HMAC', await getKey(), new TextEncoder().encode(message));
  return bytesToBase64Url(new Uint8Array(mac).slice(0, SAVE.signatureBytes));
}

export async function verify(message: string, signature: string): Promise<boolean> {
  const expected = await sign(message);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}
