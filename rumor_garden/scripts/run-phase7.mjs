import { build } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
await build({configFile:false,logLevel:'warn',build:{outDir:'artifacts/simulation',emptyOutDir:false,minify:false,
  lib:{entry:'scripts/phase7-benchmark.ts',formats:['es'],fileName:()=> 'phase7.mjs'}}});
const { benchmark } = await import('../artifacts/simulation/phase7.mjs');
const result = await benchmark(await readFile('artifacts/phase6-challenge-start.txt','utf8'),
  raw => writeFile('artifacts/phase7-offline-save.txt',raw));
await writeFile('artifacts/phase7-report.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
