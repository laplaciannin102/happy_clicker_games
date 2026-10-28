import { taleBalance } from '../data/tale';
import { createTaleState } from '../minigames/tale/state';
import Decimal from 'break_eternity.js';
import { createAutomation } from '../state/progression';
import { createPreferences } from '../state/preferences';
import { createMailState } from '../minigames/mail/state';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function migrateV4(data: Record<string, unknown>): Record<string, unknown> {
  if (data.version !== 4 || 'tale' in data) throw new Error('Invalid v4 save');
  const tale = createTaleState();
  // The current parser subsequently checks every original field.
  const best = isRecord(data.records) ? data.records.bestRunEarned : undefined;
  if (typeof best === 'string' && new Decimal(best).gte(taleBalance.unlock)) {
    tale.unlocked = true; tale.tickets = taleBalance.ticketCap;
  }
  return { ...data, version: 5, tale: { ...tale, spent: '0' } };
}

export class UnsupportedSaveError extends Error {}

export function migrateV7(data: Record<string, unknown>): Record<string, unknown> {
  if (data.version !== 7 || 'mail' in data) throw new Error('Invalid v7 save');
  return { ...data, version: 8, mail: { ...createMailState(), spent: '0' } };
}

export function migrateV6(data: Record<string, unknown>): Record<string, unknown> {
  if (data.version !== 6 || 'preferences' in data) throw new Error('Invalid v6 save');
  return { ...data, version: 7, preferences: createPreferences() };
}

export function migrateV5(data: Record<string, unknown>): Record<string, unknown> {
  if (data.version !== 5 || ['generated', 'myth', 'challenge', 'automation', 'lastOfflineGenerated'].some(key => key in data)) throw new Error('Invalid v5 save');
  return { ...data, version: 6, generated: Array.from({ length: 10 }, () => '0'),
    lastOfflineGenerated: Array.from({ length: 10 }, () => '0'),
    myth: { count: 0, archivedPoints: '0', archivedPrestiges: 0 }, challenge: { active: null, completed: [] },
    automation: { ...createAutomation(), reserve: '0', threshold: '1' } };
}

export function migrateV1(data: Record<string, unknown>): Record<string, unknown> {
  if (data.version !== 1) throw new UnsupportedSaveError('Unsupported legacy save');
  return { ...data, version: 2, tainted: false };
}

export function migrateV2(data: Record<string, unknown>): Record<string, unknown> {
  const oldKeys = ['version', 'currency', 'earned', 'owned', 'clicks', 'playSeconds',
    'lastUpdatedAt', 'seed', 'format', 'buyMode', 'tainted'];
  if (data.version !== 2 || !Array.isArray(data.owned) || data.owned.length !== 3 ||
    Object.keys(data).some(key => !oldKeys.includes(key))) throw new Error('Invalid v2 save');
  return { ...data, version: 3, owned: [...data.owned, 0, 0, 0, 0, 0, 0, 0],
    upgrades: [], achievements: [], events: { wait: -1, visible: 0, boost: 0, collected: 0 },
    offlineSeconds: 0, offlineEarned: '0', lastOffline: { seconds: 0, gained: '0', capped: false } };
}

export function migrateV3(data: Record<string, unknown>): Record<string, unknown> {
  const keys = ['version', 'currency', 'earned', 'owned', 'clicks', 'playSeconds', 'lastUpdatedAt',
    'seed', 'format', 'buyMode', 'tainted', 'upgrades', 'achievements', 'events', 'offlineSeconds', 'offlineEarned', 'lastOffline'];
  if (data.version !== 3 || !Array.isArray(data.owned) || data.owned.length !== 10 ||
    !data.owned.every((value): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) ||
    Object.keys(data).some(key => !keys.includes(key))) throw new Error('Invalid v3 save');
  return { ...data, version: 4, lifetimeEarned: data.earned,
    runSeconds: data.playSeconds, runClicks: data.clicks, startingNeighbors: 0,
    prestige: { points: '0', total: '0', count: 0, upgrades: [], lastGain: '0' },
    records: { maxOwned: [...data.owned], bestRunEarned: data.earned, bestAllOwned: Math.min(...data.owned) } };
}
