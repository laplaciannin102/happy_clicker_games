import { build } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
await build({configFile:false,logLevel:'warn',build:{outDir:'artifacts/simulation',emptyOutDir:false,minify:false,
  lib:{entry:'scripts/phase8-simulation.ts',formats:['es'],fileName:()=> 'phase8.mjs'}}});
const { runPhase8 } = await import('../artifacts/simulation/phase8.mjs');
const result=await runPhase8(await readFile('artifacts/phase6-automation-ready.txt','utf8'),
  (name,raw)=>writeFile(`artifacts/${name}`,raw));
await writeFile('artifacts/phase8-report.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
