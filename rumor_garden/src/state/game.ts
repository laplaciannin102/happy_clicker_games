import Decimal from 'break_eternity.js';
import { producers } from '../data/balance';
import { createTaleState, type TaleState } from '../minigames/tale/state';
import { createAutomation, type AutomationState, type MythState, type ChallengeState } from './progression';
import { createPreferences, type Preferences } from './preferences';
import { createMailState, type MailState } from '../minigames/mail/state';

export type NumberFormat = 'ja' | 'en' | 'scientific';
export type BuyMode = 1 | 10 | 100 | 'max';

export interface GameState {
  mail: MailState;
  preferences: Preferences;
  generated: Decimal[];
  lastOfflineGenerated: Decimal[];
  myth: MythState;
  challenge: ChallengeState;
  automation: AutomationState;
  tale: TaleState;
  currency: Decimal;
  earned: Decimal;
  lifetimeEarned: Decimal;
  runSeconds: number;
  runClicks: number;
  startingNeighbors: number;
  prestige: { points: Decimal; total: Decimal; count: number; upgrades: string[]; lastGain: Decimal };
  records: { maxOwned: number[]; bestRunEarned: Decimal; bestAllOwned: number };
  owned: number[];
  clicks: number;
  playSeconds: number;
  lastUpdatedAt: number;
  seed: number;
  format: NumberFormat;
  buyMode: BuyMode;
  tainted: boolean;
  upgrades: string[];
  achievements: string[];
  events: { wait: number; visible: number; boost: number; collected: number };
  offlineSeconds: number;
  offlineEarned: Decimal;
  lastOffline: { seconds: number; gained: Decimal; capped: boolean };
}

export function createState(now: number): GameState {
  return {
    mail: createMailState(),
    preferences: createPreferences(),
    generated: producers.map(() => new Decimal(0)), lastOfflineGenerated: producers.map(() => new Decimal(0)),
    myth: { count: 0, archivedPoints: new Decimal(0), archivedPrestiges: 0 },
    challenge: { active: null, completed: [] }, automation: createAutomation(),
    tale: createTaleState(),
    currency: new Decimal(0), earned: new Decimal(0),
    lifetimeEarned: new Decimal(0), runSeconds: 0, runClicks: 0, startingNeighbors: 0,
    prestige: { points: new Decimal(0), total: new Decimal(0), count: 0, upgrades: [], lastGain: new Decimal(0) },
    records: { maxOwned: producers.map(() => 0), bestRunEarned: new Decimal(0), bestAllOwned: 0 },
    owned: producers.map(() => 0), clicks: 0, playSeconds: 0,
    lastUpdatedAt: now, seed: now >>> 0, format: 'ja', buyMode: 1, tainted: false,
    upgrades: [], achievements: [], events: { wait: -1, visible: 0, boost: 0, collected: 0 },
    offlineSeconds: 0, offlineEarned: new Decimal(0),
    lastOffline: { seconds: 0, gained: new Decimal(0), capped: false },
  };
}
