import { presentation } from '../data/presentation';
export interface Preferences { theme: 'dark' | 'light' | 'system'; effects: boolean; sound: boolean; volume: number; autosaveSeconds: number }
export function createPreferences(): Preferences {
  return { theme: 'dark', effects: true, sound: false, volume: 0.25, autosaveSeconds: 30 };
}
export function parsePreferences(value: unknown): Preferences {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid preferences');
  const p = value as Record<string, unknown>;
  if (!['dark', 'light', 'system'].includes(String(p.theme)) || typeof p.effects !== 'boolean' || typeof p.sound !== 'boolean' ||
    typeof p.volume !== 'number' || !Number.isFinite(p.volume) || p.volume < 0 || p.volume > 1 ||
    !presentation.autosaveSeconds.some(n => n === p.autosaveSeconds) ||
    Object.keys(p).some(key => !['theme', 'effects', 'sound', 'volume', 'autosaveSeconds'].includes(key))) throw new Error('Invalid preferences');
  return { theme: p.theme as Preferences['theme'], effects: p.effects, sound: p.sound, volume: p.volume, autosaveSeconds: p.autosaveSeconds as number };
}
