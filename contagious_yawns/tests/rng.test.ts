import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/rng';

function sequence(seed: number, n: number): number[] {
  const out: number[] = [];
  let s = seed;
  for (let i = 0; i < n; i++) {
    const r = mulberry32(s);
    out.push(r.value);
    s = r.next;
  }
  return out;
}

describe('mulberry32', () => {
  it('同じシードなら同じ列', () => {
    expect(sequence(12345, 20)).toEqual(sequence(12345, 20));
  });

  it('0 以上 1 未満', () => {
    for (const v of sequence(7, 1000)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('シードが違えば列も違う', () => {
    expect(sequence(1, 5)).not.toEqual(sequence(2, 5));
  });
});
