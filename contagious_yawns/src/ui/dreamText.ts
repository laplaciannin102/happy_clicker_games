import Decimal from 'break_eternity.js';
import type { DreamEffect, DreamNodeDef } from '../data/prestige';
import { ja, t } from '../i18n/ja';
import type { Notation } from '../state/gameState';
import { formatNumber } from './format';

const pct = (v: number): number => Math.round(v * 100);

function effectText(e: DreamEffect, notation: Notation): string {
  const x = ja.dream.effects;
  switch (e.kind) {
    case 'production':
      return t(x.production, { f: e.factor });
    case 'click':
      return t(x.click, { f: e.factor });
    case 'clickRate':
      return t(x.clickRate, { p: pct(e.fraction) });
    case 'startProducer':
      return t(x.startProducer, { producer: ja.producers[e.target].name, n: e.count });
    case 'startYawns':
      return t(x.startYawns, { n: formatNumber(new Decimal(e.amount), notation) });
    case 'shardBonus':
      return t(x.shardBonus, { p: pct(e.amount) });
    case 'chain':
      return x.chain;
    case 'achievementBonus':
      return t(x.achievementBonus, { p: pct(e.amount) });
    case 'autoBuy':
      return t(x.autoBuy, { list: e.targets.map((id) => ja.producers[id].name).join('・') });
    case 'autoUpgrade':
      return x.autoUpgrade;
    case 'keepClickUpgrades':
      return x.keepClickUpgrades;
    case 'starInterval':
      return t(x.starInterval, { p: pct(1 - e.factor) });
    case 'starDuration':
      return t(x.starDuration, { f: e.factor });
    case 'starVisible':
      return t(x.starVisible, { s: e.ms / 1000 });
    case 'offlineCap':
      return t(x.offlineCap, { h: e.ms / 3_600_000 });
    case 'offlineEfficiency':
      return t(x.offlineEfficiency, { p: pct(e.amount) });
    case 'shardGain':
      return t(x.shardGain, { f: e.factor });
  }
}

export function dreamNodeName(def: DreamNodeDef): string {
  return ja.dream.names[def.id] ?? def.id;
}

/** ノードの効果の説明（複数あれば「、」でつなぐ）。 */
export function dreamNodeDesc(def: DreamNodeDef, notation: Notation): string {
  return def.effects.map((e) => effectText(e, notation)).join('、');
}
