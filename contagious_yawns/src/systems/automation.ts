import { AUTOMATION } from '../data/prestige';
import { PRODUCERS } from '../data/producers';
import type { GameState } from '../state/gameState';
import { autoBuyTargets, hasAutoUpgrade } from './dreamTree';
import { automationSpeed, hasAutoPrestige } from './hibernation';
import { shardsForRun } from './prestige';
import { buyProducer } from './purchase';
import { producerVisibility } from './unlock';
import { buyUpgrade, visibleUpgrades } from './upgrades';

export interface AutomationResult {
  producers: number;
  upgrades: string[];
}

/** オートおやすみ：解放済み・ON で、得られるかけら ≥ max(1, 累計のかけら × 設定の割合) のとき true。 */
export function shouldAutoPrestige(state: GameState): boolean {
  const { enabled, ratio } = state.settings.autoPrestige;
  if (!enabled || !hasAutoPrestige(state)) return false;
  const gain = shardsForRun(state);
  return gain > 0 && gain >= Math.max(1, state.prestige.shardsLifetime * ratio);
}

/**
 * 夢ツリーで解放した自動化（DESIGN.md §8）。interval ごとに1回（ぬくもりショップで速くなる）、
 * 自動購入は対象の生産者を安い順に1体ずつ、自動アップグレードはいちばん安いものを1つ買う。
 */
export function createAutomation(): { tick(state: GameState, dtMs: number): AutomationResult } {
  let acc = 0;
  return {
    tick(state, dtMs) {
      const result: AutomationResult = { producers: 0, upgrades: [] };
      const interval = AUTOMATION.intervalMs / automationSpeed(state);
      acc += dtMs;
      if (acc < interval) return result;
      acc %= interval;

      if (state.settings.autoUpgrade && hasAutoUpgrade(state)) {
        const cheapest = visibleUpgrades(state).find((u) => u.status === 'available');
        if (cheapest && buyUpgrade(state, cheapest.def.id)) result.upgrades.push(cheapest.def.id);
      }

      if (state.settings.autoBuy) {
        const targets = autoBuyTargets(state);
        const visible = producerVisibility(state);
        for (const def of PRODUCERS) {
          if (targets.has(def.id) && visible[def.id] === 'visible') {
            result.producers += buyProducer(state, def.id, 1);
          }
        }
      }
      return result;
    },
  };
}
