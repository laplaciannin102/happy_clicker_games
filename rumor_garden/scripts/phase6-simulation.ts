import { simulate } from './simulate';
import { createState, type GameState } from '../src/state/game';
import { buyPermanentUpgrade, createPrestigeState } from '../src/systems/prestige';
import { prestigeBalance } from '../src/data/prestige';
import { compileMyth, startChallenge } from '../src/systems/myth';
import { mythBalance } from '../src/data/myth';
import { inconsistent } from '../src/save/validation';
import { advanceWorld } from '../src/core/progression';
import { encode } from '../src/save/codec';
import { cloneAutomation } from '../src/state/progression';
import { cloneTale } from '../src/minigames/tale/state';

let fixture: GameState | undefined;
export async function runPhase6Simulation(publish?: (files: Record<string, string>) => Promise<void>) {
  let state = createState(0); state.seed = 20261028;
  const runs = [], myths = [];
  let performanceSource = state;
  for (let book = 1; book <= 3; book++) {
    for (let run = 1; state.prestige.total.lt(mythBalance.requirement) && run <= 100; run++) {
      const result = simulate('active', 86400, { startState: state,
        stopAt: prestigeBalance.requirement, stepSeconds: 5 });
      state = result.state;
      if (book === 3) performanceSource = state;
      const next = createPrestigeState(state, state.lastUpdatedAt);
      if (!next) throw new Error('Prestige target not reached');
      runs.push({ book, run, seconds: result.report.seconds, lore: next.prestige.total.toString(),
        validBefore: !inconsistent(state, state.lastUpdatedAt), validAfter: !inconsistent(next, next.lastUpdatedAt) });
      if (run % 10 === 0 || run === 1) console.error(`Book ${book} run ${run}: ${result.report.seconds}s, elapsed ${state.playSeconds}s`);
      state = next;
      for (const id of ['chain', 'inheritance', 'listener']) buyPermanentUpgrade(state, id);
    }
    state = simulate('active', 86400, { startState: state, stopAt: mythBalance.runRequirement, stepSeconds: 5 }).state;
    const next = compileMyth(state, state.lastUpdatedAt);
    if (!next) throw new Error(`Myth target not reached: lore=${state.prestige.total.toString()}, earned=${state.earned.toString()}`);
    myths.push({ book, totalSeconds: state.playSeconds, validBefore: !inconsistent(state, state.lastUpdatedAt),
      validAfter: !inconsistent(next, next.lastUpdatedAt) });
    if (book === 1) fixture = state;
    if (publish && book === 1) await publish(await createPhase6Fixtures());
    if (publish && book === 2) {
      const challenge = startChallenge(state, 'silent', state.lastUpdatedAt);
      if (!challenge) throw new Error('Missing challenge fixture');
      const ready = simulate('active', 86400, { startState: challenge, stopAt: mythBalance.challengeGoal, stepSeconds: 5 }).state;
      await publish({ 'phase6-challenge-start.txt': await encode({ ...state, lastUpdatedAt: Date.now() }),
        'phase6-challenge-ready.txt': await encode({ ...ready, lastUpdatedAt: Date.now() }) });
    }
    state = next;
  }
  if (publish) {
    const ready = simulate('active', 86400, { startState: state, stopAt: prestigeBalance.requirement, stepSeconds: 5 }).state;
    await publish({ 'phase6-automation-ready.txt': await encode({ ...ready, lastUpdatedAt: Date.now() }) });
  }
  const auto = { ...performanceSource, tale: cloneTale(performanceSource.tale), automation: cloneAutomation(performanceSource.automation),
    generated: [...performanceSource.generated], owned: [...performanceSource.owned], events: { ...performanceSource.events },
    records: { ...performanceSource.records, maxOwned: [...performanceSource.records.maxOwned] }, achievements: [...performanceSource.achievements] };
  auto.automation.purchase = true; auto.automation.research = true;
  const before = performance.now();
  advanceWorld(auto, 28800, false);
  const offlineMs = performance.now() - before;
  return { seed: 20261028, stepSeconds: 5, targetLorePerRun: 1, runs, myths, offlineMs,
    offlineSaveValid: !inconsistent(auto, auto.lastUpdatedAt),
    offlineGenerated: auto.generated.map(value => value.toString()) };
}
export async function createPhase6Fixtures() {
  if (!fixture) throw new Error('Missing fixture');
  const snapshot = { ...fixture, lastUpdatedAt: Date.now() };
  const compiled = compileMyth(snapshot, Date.now());
  if (!compiled) throw new Error('Missing compiled fixture');
  return { 'phase6-before-myth.txt': await encode(snapshot), 'phase6-after-myth.txt': await encode(compiled) };
}
