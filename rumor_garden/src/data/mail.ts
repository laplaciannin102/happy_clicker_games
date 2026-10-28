import Decimal from 'break_eternity.js';

export const mailBalance = {
  mythUnlock: 1, unlock: new Decimal(50000), minimumCost: new Decimal(1000), costSeconds: 10,
  ticketCap: 3, rechargeSeconds: 900, stages: 3, stageSeconds: 10, correctRequired: 2,
  destinations: 3, variants: 3, epilogueMyths: 3,
  postcards: ['lamp', 'well', 'cafe', 'birds', 'dream', 'postbox'] as const,
  postcardAssets: ['broadcast', 'well', 'cafe', 'birds', 'dreams', 'tale'] as const,
};
