import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { formatDuration, formatNumber } from '../src/ui/format';

const d = (v: number | string) => new Decimal(v);

describe('日本語単位', () => {
  it.each([
    [0, '0'],
    [9999, '9999'],
    [12345, '1.234万'],
    [123456, '12.34万'],
    [99_999_999, '9999万'],
    [1e8, '1.000億'],
    [3.5e12, '3.500兆'],
    [1e16, '1.000京'],
    [1e68, '1.000無量大数'],
  ])('%s → %s', (v, expected) => {
    expect(formatNumber(d(v), 'ja')).toBe(expected);
  });

  it('無量大数を超えたら指数', () => {
    expect(formatNumber(d('1.5e72'), 'ja')).toBe('1.50e72');
  });

  it('切り捨てなので、単位の繰り上がり前に 10000 と表示されない', () => {
    expect(formatNumber(d(99_999_999.9), 'ja')).toBe('9999万');
  });
});

describe('英語略記・指数', () => {
  it.each([
    [999, '999'],
    [1234, '1.23K'],
    [12_345_678, '12.3M'],
    [4.2e9, '4.20B'],
    [1e36, '1.00e36'],
  ])('en: %s → %s', (v, expected) => {
    expect(formatNumber(d(v), 'en')).toBe(expected);
  });

  it('sci', () => {
    expect(formatNumber(d(123456), 'sci')).toBe('1.23e5');
    expect(formatNumber(d(999), 'sci')).toBe('999');
  });
});

describe('小さい数・特殊値', () => {
  it('precise で小数1桁', () => {
    expect(formatNumber(d(0.1), 'ja', true)).toBe('0.1');
    expect(formatNumber(d(2.56), 'ja', true)).toBe('2.5');
    expect(formatNumber(d(2.56), 'ja')).toBe('2');
    expect(formatNumber(d(150.5), 'ja', true)).toBe('150');
  });

  it('非常に大きい数でも落ちない', () => {
    expect(formatNumber(d('ee20'), 'ja')).toMatch(/e/);
  });
});

describe('時間', () => {
  it.each([
    [0.4, 'まもなく'],
    [12.2, '13秒'],
    [125, '2分5秒'],
    [3 * 3600 + 120, '3時間2分'],
    [90_000, '1日1時間'],
    [Infinity, '∞'],
  ])('%s → %s', (sec, expected) => {
    expect(formatDuration(sec)).toBe(expected);
  });
});
