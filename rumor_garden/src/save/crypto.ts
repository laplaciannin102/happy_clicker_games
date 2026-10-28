// Client-side obfuscation only. These bytes are shipped with the game, not a secret.
const parts = [[81, 92, 68, 70, 91, 4, 78, 72], [91, 77, 76, 71, 4, 90, 76, 76],
  [77, 4, 27, 25, 27, 31, 4, 95, 27, 8, 23, 79, 66, 80]];
let key: Promise<CryptoKey> | undefined;
const encoder = new TextEncoder();

export async function signature(message: string): Promise<Uint8Array<ArrayBuffer>> {
  key ??= crypto.subtle.importKey('raw', new Uint8Array(parts.flat().map(byte => byte ^ 41)),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const full = await crypto.subtle.sign('HMAC', await key, encoder.encode(message));
  return new Uint8Array(full.slice(0, 16));
}

export function equalSignature(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) throw new Error('Invalid base64url');
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  if (toBase64Url(bytes) !== text) throw new Error('Noncanonical base64url');
  return bytes;
}
