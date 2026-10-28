import Decimal from 'break_eternity.js';
import type { NumberFormat } from '../state/game';
import { ja } from '../i18n/ja';

function trim(value: string): string { return value.replace(/\.?0+$/, ''); }

export function formatNumber(value: Decimal, style: NumberFormat): string {
  if (value.eq(0)) return '0';
  if (value.lt('0.01')) return value.toExponential(2);
  if (style === 'scientific') return value.toExponential(2);
  const unitSize = style === 'ja' ? 4 : 3;
  const units = style === 'ja' ? ja.japaneseUnits : ja.englishUnits;
  const tier = Math.floor(value.log10().toNumber() / unitSize);
  if (tier >= units.length) return value.toExponential(2);
  if (tier <= 0) return trim(value.toFixed(2));
  const scaled = value.div(Decimal.pow(10, new Decimal(tier * unitSize)));
  // Rounding should not leave values such as 1000K / 10000万.
  if (scaled.gte(new Decimal(10).pow(unitSize).sub('0.005'))) {
    if (tier + 1 >= units.length) return value.toExponential(2);
    return `1${units[tier + 1]}`;
  }
  return `${trim(scaled.toFixed(2))}${units[tier]}`;
}
