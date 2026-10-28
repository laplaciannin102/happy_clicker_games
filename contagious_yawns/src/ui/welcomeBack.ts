import { ja, t } from '../i18n/ja';
import type { Notation } from '../state/gameState';
import type { OfflineResult } from '../systems/offline';
import { noticeDialog } from './dialog';
import { formatDuration, formatNumber } from './format';

/** 「留守中に○○増えました」（SPEC §4.2）。 */
export function showWelcomeBack(
  result: OfflineResult,
  rule: { capMs: number; efficiency: number },
  notation: Notation,
): Promise<void> {
  const hours = Math.round(rule.capMs / 3_600_000);
  const lines = [
    t(ja.welcome.away, { t: formatDuration(result.awayMs / 1000) }),
    t(ja.welcome.gained, { n: formatNumber(result.gained, notation) }),
  ];
  if (result.capped) lines.push(t(ja.welcome.capped, { h: hours }));
  lines.push(t(ja.welcome.rule, { p: Math.round(rule.efficiency * 100), h: hours }));
  return noticeDialog(ja.welcome.title, lines, ja.welcome.ok);
}
