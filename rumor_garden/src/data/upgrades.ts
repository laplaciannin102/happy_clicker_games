import Decimal from 'break_eternity.js';
import { producers } from './balance';

export interface Upgrade {
  id: string; producer: number | null; tier: number;
  requirement: Decimal; cost: Decimal; multiplier: Decimal; clickAdd: Decimal;
}
const thresholds = [10, 25, 50, 100];
export const producerUpgradeCount = thresholds.length;
const priceFactors = [25, 100, 500, 2500];
const clickThresholds = [25, 500, 10000];
const clickPrices = [50, 1000, 20000];
const clickAdds = [1, 3, 10];

export const upgrades: Upgrade[] = [
  ...producers.flatMap((producer, index) => thresholds.map((count, tier) => ({
    id: `${producer.id}-${count}`, producer: index, tier,
    requirement: new Decimal(count), cost: producer.baseCost.mul(new Decimal(priceFactors[tier])),
    multiplier: new Decimal(2), clickAdd: new Decimal(0),
  }))),
  ...clickThresholds.map((amount, tier) => ({
    id: `whisper-${tier}`, producer: null, tier, requirement: new Decimal(amount),
    cost: new Decimal(clickPrices[tier]), multiplier: new Decimal(1), clickAdd: new Decimal(clickAdds[tier]),
  })),
];
