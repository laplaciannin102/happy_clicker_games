import { STAR_EFFECT_BY_ID } from '../data/stars';
import { ja, t } from '../i18n/ja';
import type { Buff, BuffSource, Notation } from '../state/gameState';
import type { StarResult } from '../systems/stars';
import { formatDuration, formatNumber } from './format';

/** 拾ったときの通知文。 */
export function starCaughtText(result: StarResult, notation: Notation): string {
  const { effect } = STAR_EFFECT_BY_ID[result.effect];
  let desc: string;
  switch (effect.kind) {
    case 'production':
      desc = t(ja.star.productionDesc, { s: effect.durationMs / 1000, f: effect.factor });
      break;
    case 'click':
      desc = t(ja.star.clickDesc, { s: effect.durationMs / 1000, f: effect.factor });
      break;
    case 'instant':
      desc = result.gained ? t(ja.star.instantDesc, { n: formatNumber(result.gained, notation) }) : '';
      break;
    case 'pillow':
      desc = result.pillow ? ja.star.pillowDesc : ja.star.pillowFull;
      break;
  }
  return t(ja.star.caught, { name: starName(result.effect), desc });
}

export function starName(id: BuffSource): string {
  if (id === 'sheep') return ja.sheep.buffName;
  if (id === 'lottery') return ja.lottery.buffName;
  return ja.star.names[id];
}

/** 効いている一時的な倍率の1行。 */
export function buffText(buff: Buff): string {
  return t(ja.star.buffLine, {
    name: starName(buff.source),
    kind: ja.star.buffKinds[buff.kind],
    f: buff.factor,
    t: formatDuration(buff.remainingMs / 1000),
  });
}
