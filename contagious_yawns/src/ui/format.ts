import Decimal from 'break_eternity.js';
import { ja, t } from '../i18n/ja';
import type { Notation } from '../state/gameState';

/** 日本語の命数（4桁ごと）。無量大数を超えたら指数表記にする。 */
const JA_UNITS = [
  '', '万', '億', '兆', '京', '垓', '秭', '穣', '溝', '澗',
  '正', '載', '極', '恒河沙', '阿僧祇', '那由他', '不可思議', '無量大数',
] as const;

/** 英語の略記（3桁ごと）。 */
const EN_UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'] as const;

/** 指数がこれを超えたら仮数を計算できないので、ライブラリの文字列表現に任せる。 */
const MAX_PLAIN_EXPONENT = 1e15;

/** 小数点以下 digits 桁で切り捨てて表示する（四捨五入で桁が繰り上がらないように）。 */
function truncate(n: number, digits: number): string {
  const p = 10 ** digits;
  return (Math.floor(n * p + 1e-9) / p).toFixed(digits);
}

function formatSmall(n: number, precise: boolean): string {
  if (precise && n < 100 && !Number.isInteger(n)) return truncate(n, 1);
  return String(Math.floor(n));
}

function formatScientific(value: Decimal, exponent: number): string {
  const mantissa = value.div(Decimal.pow(10, exponent)).toNumber();
  return `${truncate(mantissa, 2)}e${exponent}`;
}

/** 単位つき表記。step 桁ごとに単位が変わり、仮数は有効数字 step 桁で見せる。 */
function formatWithUnits(
  value: Decimal,
  exponent: number,
  step: number,
  units: readonly string[],
): string {
  const group = Math.floor(exponent / step);
  const unit = units[group];
  if (unit === undefined) return formatScientific(value, exponent);
  const mantissa = value.div(Decimal.pow(10, group * step)).toNumber();
  const digits = Math.max(0, step - 1 - Math.floor(Math.log10(mantissa)));
  return `${truncate(mantissa, digits)}${unit}`;
}

/**
 * 数値を表記設定に合わせて文字列にする（SPEC §7）。
 * precise＝true のとき、100 未満の小数を1桁まで見せる（生産量など）。
 */
export function formatNumber(value: Decimal, notation: Notation, precise = false): string {
  if (value.isNan()) return '?';
  if (!value.isFinite()) return '∞';
  if (value.lt(0)) return `-${formatNumber(value.neg(), notation, precise)}`;

  const plainLimit = notation === 'ja' ? 1e4 : 1e3;
  if (value.lt(plainLimit)) return formatSmall(value.toNumber(), precise);

  const exponent = Math.floor(value.log10().toNumber());
  if (exponent > MAX_PLAIN_EXPONENT) return value.toString();

  switch (notation) {
    case 'sci':
      return formatScientific(value, exponent);
    case 'ja':
      return formatWithUnits(value, exponent, 4, JA_UNITS);
    case 'en':
      return formatWithUnits(value, exponent, 3, EN_UNITS);
  }
}

/** 残り時間の表示。 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '∞';
  if (seconds < 1) return ja.time.soon;
  const s = Math.ceil(seconds);
  if (s < 60) return t(ja.time.sec, { s });
  if (s < 3600) return t(ja.time.min, { m: Math.floor(s / 60), s: s % 60 });
  if (s < 86400) return t(ja.time.hour, { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60) });
  return t(ja.time.day, { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600) });
}
