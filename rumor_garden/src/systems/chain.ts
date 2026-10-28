import Decimal from 'break_eternity.js';
import { balance } from '../data/balance';
import { mythBalance } from '../data/myth';
import type { GameState } from '../state/game';

export function chainActive(state: GameState): boolean {
  return state.prestige.upgrades.includes('chain') && state.challenge.active !== 'dreamless';
}
export function totalOwned(state: GameState, index: number): Decimal {
  return state.generated[index].add(new Decimal(state.owned[index]));
}
function purchased(state: GameState, index: number): boolean {
  return state.owned[index] - (index === 0 ? state.startingNeighbors : 0) > 0;
}
// Exact sum of the simultaneous 50ms recurrence x[n+1]=(I+hA)x[n].
// The binomial form includes only propagation on later steps, never in-place cascades.
export function chainEvolution(state: GameState, seconds: number): { generated: Decimal[]; integral: Decimal[] } {
  const initial = state.generated.map((_, i) => totalOwned(state, i));
  if (!chainActive(state)) return { generated: [...state.generated], integral: initial.map(n => n.mul(new Decimal(seconds))) };
  const h = balance.tickMs / 1000;
  const steps = Math.max(0, Math.floor(seconds / h + 1e-9));
  const tail = Math.max(0, seconds - steps * h);
  const tick = new Decimal(h), rate = mythBalance.chainRate;
  const final = initial.map(() => new Decimal(0)), integral = initial.map(() => new Decimal(0));
  let vector = initial, choose = new Decimal(1);
  for (let degree = 0; degree < initial.length; degree++) {
    if (degree > steps) break;
    const nextChoose = choose.mul(new Decimal(steps - degree)).div(new Decimal(degree + 1));
    for (let i = 0; i < initial.length; i++) {
      final[i] = final[i].add(vector[i].mul(choose));
      integral[i] = integral[i].add(vector[i].mul(nextChoose).mul(tick));
    }
    vector = vector.map((_, i) => i + 1 < initial.length && purchased(state, i)
      ? vector[i + 1].mul(rate).mul(tick) : new Decimal(0));
    choose = nextChoose;
  }
  const after = final.map((value, i) => {
    integral[i] = integral[i].add(value.mul(new Decimal(tail)));
    return i + 1 < final.length && purchased(state, i)
      ? value.add(final[i + 1].mul(rate).mul(new Decimal(tail))) : value;
  });
  return { generated: after.map((value, i) => Decimal.max(0, value.sub(new Decimal(state.owned[i])))), integral };
}
