import { build } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';

const phase4 = process.argv.includes('--phase4');
const phase5 = process.argv.includes('--phase5');
const phase6 = process.argv.includes('--phase6');
await build({ configFile: false, logLevel: 'warn', build: {
  outDir: 'artifacts/simulation', emptyOutDir: false, minify: false,
  lib: { entry: phase6 ? 'scripts/phase6-simulation.ts' : phase5 ? 'scripts/phase5-simulation.ts' : phase4 ? 'scripts/phase4-simulation.ts' : 'scripts/simulate.ts', formats: ['es'], fileName: () => phase6 ? 'phase6.mjs' : phase5 ? 'phase5.mjs' : phase4 ? 'phase4.mjs' : 'simulate.mjs' },
} });
const module = await import(phase6 ? '../artifacts/simulation/phase6.mjs' : phase5 ? '../artifacts/simulation/phase5.mjs' : phase4 ? '../artifacts/simulation/phase4.mjs' : '../artifacts/simulation/simulate.mjs');
const results = phase6 ? await module.runPhase6Simulation(async files => {
  await mkdir('artifacts', { recursive: true });
  for (const [name, raw] of Object.entries(files)) await writeFile(`artifacts/${name}`, raw);
}) : phase5 ? module.runPhase5Simulation() : phase4 ? module.runPhase4Simulation()
  : ['active', 'purchase-only', 'offline-after-5m'].map(strategy => module.simulate(strategy).report);
await mkdir('artifacts', { recursive: true });
if (phase4) {
  const fixtures = await module.createPhase4Fixtures();
  for (const [name, raw] of Object.entries(fixtures)) await writeFile(`artifacts/${name}`, raw);
}
if (phase5) await writeFile('artifacts/phase5-ready-save.txt', await module.createPhase5Fixture());
if (phase6) { for (const [name, raw] of Object.entries(await module.createPhase6Fixtures())) await writeFile(`artifacts/${name}`, raw); }
await writeFile(phase6 ? 'artifacts/phase6-report.json' : phase5 ? 'artifacts/phase5-report.json' : phase4 ? 'artifacts/phase4-report.json' : 'artifacts/simulation-report.json', JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
