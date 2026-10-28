import Decimal from 'break_eternity.js';

export const producers = [
  { id: 'neighbors', baseCost: new Decimal(10), production: new Decimal('0.2') },
  { id: 'well', baseCost: new Decimal(75), production: new Decimal('1.5') },
  { id: 'cafe', baseCost: new Decimal(600), production: new Decimal(12) },
  { id: 'storyteller', baseCost: new Decimal(7000), production: new Decimal(160) },
  { id: 'broadcast', baseCost: new Decimal(100000), production: new Decimal(2400) },
  { id: 'birds', baseCost: new Decimal(1600000), production: new Decimal(45000) },
  { id: 'dreams', baseCost: new Decimal(30000000), production: new Decimal(1000000) },
  { id: 'theater', baseCost: new Decimal(800000000), production: new Decimal(35000000) },
  { id: 'causality', baseCost: new Decimal(30000000000), production: new Decimal(1500000000) },
  { id: 'world', baseCost: new Decimal(2000000000000), production: new Decimal(120000000000) },
] as const;

export const balance = {
  growth: new Decimal('1.15'),
  revealRatio: new Decimal('0.2'),
  clickBase: new Decimal(1),
  clickProductionRatio: new Decimal('0.01'),
  synergyPerOwned: new Decimal('0.01'),
  synergyCap: 50,
  tickMs: 50,
  renderMs: 100,
  catchUpThresholdMs: 1000,
  offlineCapMs: 8 * 60 * 60 * 1000,
  autosaveMs: 30_000,
  backupCount: 3,
  achievementBonus: new Decimal('0.005'),
  eventUnlock: new Decimal(5000),
  eventIntervalMin: 90,
  eventIntervalMax: 150,
  eventVisibleSeconds: 15,
  eventBoostSeconds: 30,
  eventMultiplier: new Decimal(3),
  statisticsUnlock: new Decimal(5000),
  researchUnlock: new Decimal(25),
} as const;
