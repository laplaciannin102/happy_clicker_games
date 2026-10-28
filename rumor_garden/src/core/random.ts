// Mulberry32. The returned seed is saved; no Math.random is used for game outcomes.
export function random(seed: number): { seed: number; value: number } {
  const next = (seed + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { seed: next, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}
