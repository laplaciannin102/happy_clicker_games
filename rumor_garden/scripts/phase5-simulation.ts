import { simulate } from './simulate';
import { prestigeBalance } from '../src/data/prestige';
import { taleBalance as b } from '../src/data/tale';
import { inconsistent } from '../src/save/validation';
import { encode } from '../src/save/codec';
import { random } from '../src/core/random';

export function runPhase5Simulation() {
  const strategies = [undefined, 'bank-safe', 'safe', 'bold'] as const;
  const progression = strategies.map(talePolicy => {
    const { state, report } = simulate('active', 7200, { stopAt: prestigeBalance.requirement, talePolicy });
    return { policy: talePolicy ?? 'skip', ...report, saveValid: !inconsistent(state, state.lastUpdatedAt) };
  });
  // Fixed production, no other event: expected incremental production in base-rate seconds.
  const expected = (['safe', 'bold'] as const).flatMap(choice => [1, 2, 3].map(stages => ({
    choice, stages, successChance: b.choices[choice].chance ** stages,
    rewardSeconds: b.choices[choice].points * stages * b.rewardSeconds,
    expectedExtraSeconds: b.choices[choice].chance ** stages * b.choices[choice].points * stages * b.rewardSeconds,
    costSeconds: b.costSeconds.toNumber(),
  })));
  return { progression, expected, note: 'Expected values assume fixed production and the rate-based fee, excluding the 1,000 minimum and other events.' };
}
export async function createPhase5Fixture() {
  const state = simulate('active', 1200).state;
  // A deterministic successful path for UI QA; separate from measured progression.
  for (let candidate = 1; candidate < 100000; candidate++) {
    let seed = candidate; let good = true;
    for (let i = 0; i < b.stages; i++) { const next = random(seed); seed = next.seed; good &&= next.value < b.choices.bold.chance; }
    if (good) { state.seed = candidate; break; }
  }
  state.lastUpdatedAt = Date.now();
  if (inconsistent(state, Date.now())) throw new Error('Invalid Phase 5 UI fixture');
  return encode(state);
}
