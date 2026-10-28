import Decimal from 'break_eternity.js';

export const mythBalance = {
  requirement: new Decimal(100), runRequirement: new Decimal('1e12'),
  multiplier: new Decimal('1.5'), challengeMultiplier: new Decimal('1.1'),
  challengeGoal: new Decimal('1e7'), chainRate: new Decimal('0.001'),
  autoInterval: 1, purchaseUnlock: 1, researchUnlock: 2, prestigeUnlock: 3,
} as const;
export const challengeIds = ['silent', 'alleys', 'dreamless'] as const;
export type ChallengeId = typeof challengeIds[number];
