import Decimal from 'break_eternity.js';

export const taleBalance = {
  unlock: new Decimal(50000), minimumCost: new Decimal(1000), costSeconds: new Decimal(10),
  ticketCap: 3, rechargeSeconds: 900, stageSeconds: 10, stages: 3,
  rewardSeconds: 10, maxPoints: 6, multiplier: new Decimal(2), maxTemporary: new Decimal(6),
  choices: { safe: { chance: 0.9, points: 1 }, bold: { chance: 0.6, points: 2 } },
} as const;
