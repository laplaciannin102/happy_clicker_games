import Decimal from 'break_eternity.js';

export const prestigeBalance = {
  // Calibrated to a first prestige in 30–60 minutes; see docs/BALANCE.md.
  requirement: new Decimal('1e17'),
  preview: new Decimal('1e6'),
  bonusPerPoint: new Decimal('0.1'),
  startingNeighbors: 5,
} as const;

export const permanentUpgrades = [
  { id: 'listener', cost: new Decimal(5), clickMultiplier: new Decimal(2), startingNeighbors: 0 },
  { id: 'inheritance', cost: new Decimal(10), clickMultiplier: new Decimal(1), startingNeighbors: prestigeBalance.startingNeighbors },
  { id: 'chain', cost: new Decimal(20), clickMultiplier: new Decimal(1), startingNeighbors: 0 },
] as const;
