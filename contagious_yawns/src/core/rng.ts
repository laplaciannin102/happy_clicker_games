/**
 * mulberry32 の1ステップ。状態（シード）を GameState に保存し、
 * セーブ&ロードで乱数がやり直せないようにする（SPEC §3 鉄則5）。
 */
export function mulberry32(seed: number): { value: number; next: number } {
  const next = (seed + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, next };
}

export function createSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] ?? 1;
}
