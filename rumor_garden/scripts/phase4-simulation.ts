import Decimal from 'break_eternity.js';
import { simulate } from './simulate';
import { prestigeBalance } from '../src/data/prestige';
import { createPrestigeState, prestigeReward, buyPermanentUpgrade } from '../src/systems/prestige';
import { encode } from '../src/save/codec';
import { grantAchievements } from '../src/systems/achievements';
import { inconsistent } from '../src/save/validation';
import type { GameState } from '../src/state/game';

let readyState: GameState | undefined;
export function runPhase4Simulation() {
  const first = simulate('active', 7200, { stopAt: prestigeBalance.requirement, clicksPerSecond: 2 });
  readyState = first.state;
  const initial = [first.report,
    simulate('active', 7200, { stopAt: prestigeBalance.requirement, clicksPerSecond: 1 }).report,
    simulate('purchase-only', 7200, { stopAt: prestigeBalance.requirement, clicksPerSecond: 0 }).report];
  const repeatedRuns = [];
  let current = first.state;
  for (let run = 1; run <= 3; run++) {
    const reward = prestigeReward(current);
    const next = createPrestigeState(current, current.lastUpdatedAt);
    if (!next) throw new Error('Simulation did not reach prestige');
    for (const id of ['listener', 'inheritance']) buyPermanentUpgrade(next, id);
    repeatedRuns.push({ run, seconds: current.runSeconds, reward: reward.toString(),
      totalPoints: next.prestige.total.toString(), ownedPermanent: [...next.prestige.upgrades],
      currentSaveValid: !inconsistent(current, current.lastUpdatedAt),
      resetSaveValid: !inconsistent(next, next.lastUpdatedAt) });
    if (run < 3) current = simulate('active', 7200, { startState: next, stopAt: prestigeBalance.requirement }).state;
  }
  return { requirement: prestigeBalance.requirement.toString(), initial, repeatedRuns };
}

// Reproducible UI fixtures, kept out of the shipped game and Git. The second fixture
// deliberately extends the simulated run's income/time to exercise the 5-point purchase.
export async function createPhase4Fixtures() {
  if (!readyState) throw new Error('Run the simulation first');
  const ready: GameState = { ...readyState, lastUpdatedAt: Date.now(), owned: [...readyState.owned],
    upgrades: [...readyState.upgrades], achievements: [...readyState.achievements], events: { ...readyState.events },
    records: { ...readyState.records, maxOwned: [...readyState.records.maxOwned] },
    prestige: { ...readyState.prestige, upgrades: [...readyState.prestige.upgrades] } };
  const synthetic: GameState = { ...ready, records: { ...ready.records, maxOwned: [...ready.records.maxOwned] },
    achievements: [...ready.achievements], earned: prestigeBalance.requirement.mul(25) };
  const increase = synthetic.earned.sub(ready.earned);
  synthetic.currency = ready.currency.add(increase);
  synthetic.lifetimeEarned = new Decimal(synthetic.earned);
  synthetic.playSeconds = synthetic.runSeconds = ready.playSeconds * 25;
  grantAchievements(synthetic);
  const permanent = createPrestigeState(synthetic, Date.now());
  if (!permanent || permanent.prestige.points.lt(5) || inconsistent(permanent, Date.now())) throw new Error('Invalid UI fixture');
  return { 'phase4-ready-save.txt': await encode(ready), 'phase4-permanent-save.txt': await encode(permanent) };
}
