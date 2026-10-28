import Decimal from 'break_eternity.js';
import { expect, it } from 'vitest';
import { formatNumber } from '../src/ui/format';

it('日本語・英語・指数表記と、小数・単位境界・巨大数を表示する', () => {
  expect(formatNumber(new Decimal(0), 'ja')).toBe('0');
  expect(formatNumber(new Decimal('0.2'), 'ja')).toBe('0.2');
  expect(formatNumber(new Decimal(100), 'ja')).toBe('100');
  expect(formatNumber(new Decimal(12345), 'ja')).toBe('1.23万');
  expect(formatNumber(new Decimal(100000000), 'ja')).toBe('1億');
  expect(formatNumber(new Decimal(12345), 'en')).toBe('12.35K');
  expect(formatNumber(new Decimal(12345), 'scientific')).toBe('1.23e+4');
  expect(formatNumber(new Decimal('999999.999'), 'en')).toBe('1M');
  expect(formatNumber(new Decimal('1e5000'), 'ja')).toContain('e');
});
