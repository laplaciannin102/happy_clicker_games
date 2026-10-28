import type { UpgradeDef } from '../data/upgrades';
import { ja, t } from '../i18n/ja';

/** アップグレードの表示名。 */
export function upgradeName(def: UpgradeDef): string {
  const named = ja.upgrade.names[def.id];
  if (named) return named;
  switch (def.group) {
    case 'tier': {
      const producer = def.effect.kind === 'producer' ? ja.producers[def.effect.target].name : '';
      return t(ja.upgrade.tierName, { producer, tier: ja.upgrade.tierNames[def.tier ?? 0] ?? '' });
    }
    case 'global': {
      const index = Number(def.id.split('_')[1] ?? 1) - 1;
      return ja.upgrade.globalNames[index] ?? def.id;
    }
    default:
      return def.id;
  }
}

/** アップグレードの効果の説明。 */
export function upgradeDesc(def: UpgradeDef): string {
  const e = def.effect;
  switch (e.kind) {
    case 'producer':
      return t(ja.upgrade.tierDesc, { producer: ja.producers[e.target].name, f: e.factor });
    case 'synergy':
      return t(ja.upgrade.synergyDesc, {
        a: ja.producers[e.targets[0]].name,
        b: ja.producers[e.targets[1]].name,
        f: e.factor,
      });
    case 'global':
      return t(ja.upgrade.globalDesc, { f: e.factor });
    case 'clickFlat':
      return t(ja.upgrade.clickFlatDesc, { n: e.amount });
    case 'clickRate':
      return t(ja.upgrade.clickRateDesc, { p: Math.round(e.fraction * 100) });
  }
}
