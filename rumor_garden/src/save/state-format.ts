import Decimal from 'break_eternity.js';
import { SAVE_VERSION } from '../config';
import { balance, producers } from '../data/balance';
import { upgrades } from '../data/upgrades';
import { achievements } from '../data/achievements';
import { permanentUpgrades } from '../data/prestige';
import type { GameState } from '../state/game';
import { isRecord } from './migrations';
import { parseTale } from './tale-format';
import { decimalArray, parseMyth, parseChallenge, parseAutomation } from './progression-format';
import { parsePreferences } from '../state/preferences';
import { parseMail } from './mail-format';

function nonnegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
function integer(value: unknown): value is number { return nonnegative(value) && Number.isSafeInteger(value); }
function decimal(value: unknown): Decimal {
  if (typeof value !== 'string' || value.length > 10_000) throw new Error('Invalid decimal');
  const parsed = new Decimal(value);
  if (!parsed.isFinite() || parsed.lt(0) || parsed.toString() !== value) throw new Error('Invalid decimal');
  return parsed;
}
function ids(value: unknown, known: string[]): value is string[] {
  return Array.isArray(value) && value.every(id => typeof id === 'string' && known.includes(id)) &&
    new Set(value).size === value.length;
}

export function serialize(state: GameState): string {
  return JSON.stringify({ version: SAVE_VERSION, currency: state.currency.toString(),
    earned: state.earned.toString(), owned: state.owned, clicks: state.clicks,
    playSeconds: state.playSeconds, lastUpdatedAt: state.lastUpdatedAt,
    seed: state.seed, format: state.format, buyMode: state.buyMode, tainted: state.tainted,
    upgrades: state.upgrades, achievements: state.achievements, events: state.events,
    offlineSeconds: state.offlineSeconds, offlineEarned: state.offlineEarned.toString(),
    lastOffline: { ...state.lastOffline, gained: state.lastOffline.gained.toString() },
    lifetimeEarned: state.lifetimeEarned.toString(), runSeconds: state.runSeconds,
    runClicks: state.runClicks, startingNeighbors: state.startingNeighbors,
    prestige: { ...state.prestige, points: state.prestige.points.toString(), total: state.prestige.total.toString(),
      lastGain: state.prestige.lastGain.toString() },
    records: { ...state.records, bestRunEarned: state.records.bestRunEarned.toString() },
    tale: { ...state.tale, spent: state.tale.spent.toString() }, generated: state.generated.map(n => n.toString()),
    lastOfflineGenerated: state.lastOfflineGenerated.map(n => n.toString()),
    myth: { ...state.myth, archivedPoints: state.myth.archivedPoints.toString() }, challenge: state.challenge,
    automation: { ...state.automation, reserve: state.automation.reserve.toString(), threshold: state.automation.threshold.toString() },
    preferences: state.preferences, mail: { ...state.mail, spent: state.mail.spent.toString() } });
}

export function parseState(data: unknown): GameState {
  if (!isRecord(data) || data.version !== SAVE_VERSION || !Array.isArray(data.owned) ||
    data.owned.length !== producers.length || !data.owned.every(integer) ||
    !integer(data.clicks) || !nonnegative(data.playSeconds) ||
    !integer(data.lastUpdatedAt) || !integer(data.seed) || data.seed > 0xffffffff ||
    !['ja', 'en', 'scientific'].includes(String(data.format)) ||
    ![1, 10, 100, 'max'].includes(data.buyMode as string | number) ||
    typeof data.tainted !== 'boolean' || !ids(data.upgrades, upgrades.map(item => item.id)) ||
    !ids(data.achievements, achievements.map(item => item.id)) ||
    !nonnegative(data.offlineSeconds) || !isRecord(data.events) || !isRecord(data.lastOffline) ||
    !nonnegative(data.runSeconds) || !integer(data.runClicks) || !integer(data.startingNeighbors) ||
    !isRecord(data.prestige) || !isRecord(data.records)) {
    throw new Error('Invalid save structure');
  }
  const events = data.events, offline = data.lastOffline;
  const prestige = data.prestige, records = data.records;
  if (!integer(prestige.count) || !ids(prestige.upgrades, permanentUpgrades.map(item => item.id)) ||
    !Array.isArray(records.maxOwned) || records.maxOwned.length !== producers.length ||
    !records.maxOwned.every(integer) || !integer(records.bestAllOwned)) throw new Error('Invalid prestige records');
  if (typeof events.wait !== 'number' || !Number.isFinite(events.wait) || events.wait < -1 ||
    events.wait > balance.eventIntervalMax || !nonnegative(events.visible) || events.visible > balance.eventVisibleSeconds ||
    !nonnegative(events.boost) || events.boost > balance.eventBoostSeconds || !integer(events.collected) ||
    !nonnegative(offline.seconds) || offline.seconds > balance.offlineCapMs / 1000 || typeof offline.capped !== 'boolean') {
    throw new Error('Invalid event or offline record');
  }
  const keys = ['version', 'currency', 'earned', 'owned', 'clicks', 'playSeconds',
    'lastUpdatedAt', 'seed', 'format', 'buyMode', 'tainted', 'upgrades', 'achievements',
    'events', 'offlineSeconds', 'offlineEarned', 'lastOffline', 'lifetimeEarned', 'runSeconds', 'runClicks',
    'startingNeighbors', 'prestige', 'records', 'tale', 'generated', 'lastOfflineGenerated', 'myth', 'challenge', 'automation', 'preferences', 'mail'];
  if (Object.keys(data).some(key => !keys.includes(key)) ||
    Object.keys(events).some(key => !['wait', 'visible', 'boost', 'collected'].includes(key)) ||
    Object.keys(offline).some(key => !['seconds', 'gained', 'capped'].includes(key)) ||
    Object.keys(prestige).some(key => !['points', 'total', 'count', 'upgrades', 'lastGain'].includes(key)) ||
    Object.keys(records).some(key => !['maxOwned', 'bestRunEarned', 'bestAllOwned'].includes(key))) throw new Error('Unknown save fields');
  return { mail: parseMail(data.mail), preferences: parsePreferences(data.preferences), generated: decimalArray(data.generated), lastOfflineGenerated: decimalArray(data.lastOfflineGenerated),
    myth: parseMyth(data.myth), challenge: parseChallenge(data.challenge), automation: parseAutomation(data.automation),
    tale: parseTale(data.tale), currency: decimal(data.currency), earned: decimal(data.earned),
    owned: [...data.owned], clicks: data.clicks, playSeconds: data.playSeconds,
    lastUpdatedAt: data.lastUpdatedAt, seed: data.seed,
    format: data.format as GameState['format'], buyMode: data.buyMode as GameState['buyMode'],
    tainted: data.tainted, upgrades: [...data.upgrades], achievements: [...data.achievements],
    events: { wait: events.wait, visible: events.visible, boost: events.boost, collected: events.collected },
    offlineSeconds: data.offlineSeconds, offlineEarned: decimal(data.offlineEarned),
    lastOffline: { seconds: offline.seconds, gained: decimal(offline.gained), capped: offline.capped },
    lifetimeEarned: decimal(data.lifetimeEarned), runSeconds: data.runSeconds, runClicks: data.runClicks,
    startingNeighbors: data.startingNeighbors,
    prestige: { points: decimal(prestige.points), total: decimal(prestige.total), count: prestige.count,
      upgrades: [...prestige.upgrades], lastGain: decimal(prestige.lastGain) },
    records: { maxOwned: [...records.maxOwned], bestRunEarned: decimal(records.bestRunEarned), bestAllOwned: records.bestAllOwned } };
}
