import Decimal from 'break_eternity.js';
import type { AchievementDef } from '../data/achievements';
import { ja, t } from '../i18n/ja';
import type { Notation } from '../state/gameState';
import { formatNumber } from './format';

/** 実績の名前と説明（解除前の隠し実績も含め、素の文言を返す）。 */
export function achievementText(def: AchievementDef, notation: Notation): { name: string; desc: string } {
  const a = ja.achievement;
  const c = def.condition;
  const n = (v: number): string => formatNumber(new Decimal(v), notation);
  switch (def.group) {
    case 'yawns':
      return { name: a.yawns.names[def.index] ?? def.id, desc: t(a.yawns.desc, { n: n(c.kind === 'lifetimeYawns' ? c.amount : 0) }) };
    case 'rate':
      return { name: a.rate.names[def.index] ?? def.id, desc: t(a.rate.desc, { n: n(c.kind === 'rate' ? c.amount : 0) }) };
    case 'clicks':
      return { name: a.clicks.names[def.index] ?? def.id, desc: t(a.clicks.desc, { n: n(c.kind === 'lifetimeClicks' ? c.count : 0) }) };
    case 'producer': {
      if (c.kind !== 'owned') return { name: def.id, desc: '' };
      const producer = ja.producers[c.target].name;
      const tpl = c.count === 1 ? a.producerFirst : a.producerMany;
      return { name: t(tpl.name, { producer }), desc: t(tpl.desc, { producer, n: c.count }) };
    }
    case 'ownedTotal':
      return { name: a.ownedTotal.names[def.index] ?? def.id, desc: t(a.ownedTotal.desc, { n: c.kind === 'ownedTotal' ? c.count : 0 }) };
    case 'upgrades':
      return { name: a.upgrades.names[def.index] ?? def.id, desc: t(a.upgrades.desc, { n: c.kind === 'upgrades' ? c.count : 0 }) };
    case 'stars':
      return { name: a.stars.names[def.index] ?? def.id, desc: t(a.stars.desc, { n: c.kind === 'lifetimeStars' ? c.count : 0 }) };
    case 'prestige':
      return { name: a.prestige.names[def.index] ?? def.id, desc: t(a.prestige.desc, { n: c.kind === 'prestigeCount' ? c.count : 0 }) };
    case 'challenge':
      return { name: a.challenge.names[def.index] ?? def.id, desc: t(a.challenge.desc, { n: c.kind === 'challenges' ? c.count : 0 }) };
    case 'hibernation':
      return { name: a.hibernation.names[def.index] ?? def.id, desc: t(a.hibernation.desc, { n: c.kind === 'hibernationCount' ? c.count : 0 }) };
    case 'sheep':
      if (c.kind === 'sheepCollection') return a.sheepCollection;
      return { name: a.sheep.names[def.index] ?? def.id, desc: t(a.sheep.desc, { n: c.kind === 'sheepPlays' ? c.count : 0 }) };
    case 'lottery':
      if (c.kind === 'lotteryJackpots') return a.lotteryJackpot;
      return { name: a.lottery.names[def.index] ?? def.id, desc: t(a.lottery.desc, { n: c.kind === 'lotteryPlays' ? c.count : 0 }) };
    case 'ending':
      return a.ending[def.id] ?? { name: def.id, desc: '' };
    case 'hidden':
      return a.hidden[def.id] ?? { name: def.id, desc: '' };
  }
}
