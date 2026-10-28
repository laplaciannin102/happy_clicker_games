import { decode, encode, serialize } from '../src/save/codec';
import { parseState } from '../src/save/state-format';
import { catchUp } from '../src/core/time';
import { catchUpAsync, yieldToBrowser } from '../src/core/offline';
import { inconsistent } from '../src/save/validation';

// Uses the legitimate campaign fixture produced by simulate:phase6.
export async function benchmark(raw: string, publish: (raw: string) => Promise<void>) {
  const now = Date.now(), source = await decode(raw, now);
  source.automation.purchase = true;
  source.lastUpdatedAt = now - 8 * 3600000;
  await publish(await encode(source));
  const sync = parseState(JSON.parse(serialize(source)) as unknown);
  const asyncState = parseState(JSON.parse(serialize(source)) as unknown);
  let start = performance.now(); catchUp(sync, now); const syncMs = performance.now() - start;
  let sliceStart = performance.now(), maxSliceMs = 0, yields = 0;
  start = performance.now();
  await catchUpAsync(asyncState, now, { yieldControl: async () => {
    maxSliceMs = Math.max(maxSliceMs, performance.now() - sliceStart); yields++;
    await yieldToBrowser(); sliceStart = performance.now();
  } });
  maxSliceMs = Math.max(maxSliceMs, performance.now() - sliceStart);
  return { fixture: 'phase6-challenge-start.txt', hours: 8, syncMs, asyncMs: performance.now() - start,
    maxSliceMs, yields, currencyRatio: asyncState.currency.div(sync.currency).toNumber(),
    sameOwned: JSON.stringify(sync.owned) === JSON.stringify(asyncState.owned),
    sameGenerated: sync.generated.every((v,i) => v.eq(asyncState.generated[i])),
    valid: !inconsistent(asyncState, now) };
}
