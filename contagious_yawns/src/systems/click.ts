import Decimal from 'break_eternity.js';
import { ECONOMY } from '../data/economy';
import type { GameState } from '../state/gameState';
import { buffMultiplier } from './buffs';
import { challengeClickMultiplier, clicksDisabled } from './challenges';
import { dreamClickMultiplier, dreamClickRate } from './dreamTree';
import { earn, totalRate } from './production';
import { clickBonus } from './upgrades';

/** 1クリックで得るあくび：((基本 + 固定の加算) + 毎秒生産量 × 割合) × 夢の倍率 × 一時的な倍率。 */
export function clickValue(state: GameState): Decimal {
  const { flat, rateFraction: fromUpgrades } = clickBonus(state);
  const rateFraction = fromUpgrades + dreamClickRate(state);
  const base = new Decimal(ECONOMY.clickBase + flat);
  const value = rateFraction > 0 ? base.add(totalRate(state).mul(rateFraction)) : base;
  return value.mul(dreamClickMultiplier(state)).mul(challengeClickMultiplier(state)).mul(buffMultiplier(state, 'click'));
}

export function performClick(state: GameState): Decimal {
  // 「徹夜明け」ではクリックできない
  if (clicksDisabled(state)) return new Decimal(0);
  const value = clickValue(state);
  earn(state, value);
  state.clicks += 1;
  state.lifetime.clicks += 1;
  return value;
}
