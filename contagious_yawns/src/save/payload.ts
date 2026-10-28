import Decimal from 'break_eternity.js';
import { ACHIEVEMENT_BY_ID } from '../data/achievements';
import { CHALLENGE_BY_ID } from '../data/challenges';
import { WARMTH_ITEM_BY_ID } from '../data/hibernation';
import { LOTTERY } from '../data/lottery';
import { PILLOWS, RARE_SHEEP } from '../data/minigames';
import { DREAM_NODE_BY_ID, ENCORE } from '../data/prestige';
import { PRODUCER_IDS } from '../data/producers';
import { STAR_EFFECT_IDS, type StarEffectId } from '../data/stars';
import { UPGRADE_BY_ID } from '../data/upgrades';
import {
  AUTOSAVE_SECONDS,
  AUTO_PRESTIGE_RATIOS,
  BUFF_KINDS,
  BUY_AMOUNTS,
  NOTATIONS,
  THEMES,
  VOLUME_STEP,
  createProducerStates,
  type Buff,
  type BuffKind,
  type BuffSource,
  type ChallengeState,
  type HibernationState,
  type LotteryState,
  type MinigameState,
  type BuyAmount,
  type GameState,
  type Notation,
  type Theme,
  type AutosaveSeconds,
  type PrestigeState,
  type StarState,
} from '../state/gameState';

/** GameState ⇔ セーブ用のプレーンなオブジェクト（最新のスキーマ版）。Decimal は文字列にする。 */
export function toPayload(state: GameState): Record<string, unknown> {
  return {
    yawns: state.yawns.toString(),
    totalYawns: state.totalYawns.toString(),
    clicks: state.clicks,
    producers: Object.fromEntries(
      Object.entries(state.producers).map(([id, p]) => [id, { bought: p.bought, infected: p.infected.toString() }]),
    ),
    upgrades: [...state.upgrades].sort(),
    achievements: Object.fromEntries(state.achievements),
    lifetime: {
      yawns: state.lifetime.yawns.toString(),
      clicks: state.lifetime.clicks,
      playTimeMs: state.lifetime.playTimeMs,
      stars: state.lifetime.stars,
    },
    stars: state.stars,
    buffs: state.buffs,
    prestige: {
      shards: state.prestige.shards,
      shardsLifetime: state.prestige.shardsLifetime,
      count: state.prestige.count,
      nodes: [...state.prestige.nodes].sort(),
      encore: state.prestige.encore,
    },
    hibernation: { ...state.hibernation, shop: [...state.hibernation.shop].sort() },
    challenges: { active: state.challenges.active, completed: [...state.challenges.completed].sort() },
    minigames: { ...state.minigames, collection: [...state.minigames.collection].sort() },
    rngSeed: state.rngSeed,
    playTimeMs: state.playTimeMs,
    createdAt: state.createdAt,
    lastSavedAt: state.lastSavedAt,
    settings: state.settings,
    awakenedAt: state.awakenedAt,
    tainted: state.tainted,
  };
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Decimal#toString が出す形（"123.4"、"1.5e400"、"ee20" など）。
 * new Decimal('abc') はエラーにならず 0 になるので、先に形をチェックする。
 */
const DECIMAL_PATTERN = /^e*-?\d+(\.\d+)?(e[+-]?\d+(\.\d+)?)?$/;

function parseDecimal(v: unknown): Decimal | null {
  if (typeof v !== 'string' || !DECIMAL_PATTERN.test(v)) return null;
  const d = new Decimal(v);
  if (d.isNan() || !d.isFinite() || d.lt(0)) return null;
  return d;
}

function isNonNegInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
}

function isNonNegNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

function isNotation(v: unknown): v is Notation {
  return NOTATIONS.some((n) => n === v);
}

function isVolume(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100 && v % VOLUME_STEP === 0;
}

function isBuyAmount(v: unknown): v is BuyAmount {
  return BUY_AMOUNTS.some((a) => a === v);
}

function isStarEffectId(v: unknown): v is StarEffectId {
  return STAR_EFFECT_IDS.some((id) => id === v);
}

function isBuffSource(v: unknown): v is BuffSource {
  return v === 'sheep' || v === 'lottery' || isStarEffectId(v);
}

function parseChallenges(v: unknown): ChallengeState | null {
  if (!isRecord(v) || !Array.isArray(v.completed) || !v.completed.every((c) => typeof c === 'string')) return null;
  if (v.active !== null && typeof v.active !== 'string') return null;
  // 知らないチャレンジは読み飛ばす
  const active = typeof v.active === 'string' && CHALLENGE_BY_ID.has(v.active) ? v.active : null;
  return { active, completed: new Set((v.completed as string[]).filter((c) => CHALLENGE_BY_ID.has(c))) };
}

function parseHibernation(v: unknown): HibernationState | null {
  if (!isRecord(v) || !isNonNegInt(v.warmth) || !isNonNegInt(v.warmthLifetime) || !isNonNegInt(v.count)) return null;
  if (!Array.isArray(v.shop) || !v.shop.every((s) => typeof s === 'string')) return null;
  // 知らない品は読み飛ばす
  const shop = new Set((v.shop as string[]).filter((id) => WARMTH_ITEM_BY_ID.has(id)));
  return { warmth: v.warmth, warmthLifetime: v.warmthLifetime, count: v.count, shop };
}

function parseLottery(v: unknown): LotteryState | null {
  if (!isRecord(v)) return null;
  const { tickets, plays, runPlays, jackpots, active } = v;
  if (!isNonNegInt(tickets) || tickets > LOTTERY.ticketsMax || !isNonNegInt(plays) || !isNonNegInt(runPlays)) return null;
  if (!isNonNegInt(jackpots) || jackpots > plays || runPlays > plays) return null;
  if (active === null) return { tickets, plays, runPlays, jackpots, active: null };
  if (!isRecord(active) || !isNonNegInt(active.seed) || active.seed > 0xffffffff || !Array.isArray(active.holds)) return null;
  const holds = active.holds as unknown[];
  const validHold = (h: unknown): h is boolean[] =>
    Array.isArray(h) && h.length === LOTTERY.reels && h.every((b) => typeof b === 'boolean');
  if (holds.length > LOTTERY.respins || !holds.every(validHold)) return null;
  return { tickets, plays, runPlays, jackpots, active: { seed: active.seed, holds: holds.map((h) => [...h]) } };
}

function parseMinigames(v: unknown): MinigameState | null {
  if (!isRecord(v)) return null;
  const { pillows, pillowTimerMs, sheepPlays, sheepRunPlays, sheepBest, collection, active } = v;
  if (!isNonNegInt(pillows) || pillows > PILLOWS.max || !isNonNegNumber(pillowTimerMs)) return null;
  if (!isNonNegInt(sheepPlays) || !isNonNegInt(sheepRunPlays) || !isNonNegInt(sheepBest)) return null;
  if (!Array.isArray(collection) || !collection.every((c) => typeof c === 'string')) return null;
  let session: MinigameState['active'] = null;
  if (active !== null) {
    if (!isRecord(active) || !isNonNegInt(active.seed) || active.seed > 0xffffffff) return null;
    session = { seed: active.seed };
  }
  // 知らない羊は読み飛ばす
  const known = new Set<string>(RARE_SHEEP);
  const lottery = parseLottery(v.lottery);
  if (!lottery) return null;
  return {
    pillows,
    pillowTimerMs,
    sheepPlays,
    sheepRunPlays,
    sheepBest,
    collection: new Set((collection as string[]).filter((c) => known.has(c))),
    active: session,
    lottery,
  };
}

function isFraction(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
}

function parseStars(v: unknown): StarState | null {
  if (!isRecord(v) || !isNonNegNumber(v.timerMs) || !isNonNegInt(v.clicked)) return null;
  const a = v.active;
  if (a === null) return { timerMs: v.timerMs, active: null, clicked: v.clicked };
  if (!isRecord(a) || !isStarEffectId(a.effect) || !isFraction(a.x) || !isFraction(a.y)) return null;
  if (!isNonNegNumber(a.remainingMs)) return null;
  return {
    timerMs: v.timerMs,
    active: { effect: a.effect, x: a.x, y: a.y, remainingMs: a.remainingMs },
    clicked: v.clicked,
  };
}

function parsePrestige(v: unknown): PrestigeState | null {
  if (!isRecord(v) || !isNonNegInt(v.shards) || !isNonNegInt(v.shardsLifetime) || !isNonNegInt(v.count)) {
    return null;
  }
  if (!Array.isArray(v.nodes) || !v.nodes.every((n) => typeof n === 'string')) return null;
  if (!isNonNegInt(v.encore) || v.encore > ENCORE.maxLevel) return null;
  // 知らないノード ID は読み飛ばす
  const nodes = new Set((v.nodes as string[]).filter((n) => DREAM_NODE_BY_ID.has(n)));
  return { shards: v.shards, shardsLifetime: v.shardsLifetime, count: v.count, nodes, encore: v.encore };
}

function parseBuffs(v: unknown): Buff[] | null {
  if (!Array.isArray(v)) return null;
  const out: Buff[] = [];
  for (const b of v as unknown[]) {
    if (!isRecord(b) || !BUFF_KINDS.some((k) => k === b.kind) || !isBuffSource(b.source)) return null;
    if (!isNonNegNumber(b.factor) || !isNonNegNumber(b.remainingMs)) return null;
    out.push({ kind: b.kind as BuffKind, factor: b.factor, remainingMs: b.remainingMs, source: b.source });
  }
  return out;
}

/** 最新版の形のオブジェクトから GameState を作る。1か所でもおかしければ null（部分的には読まない）。 */
export function fromPayload(raw: unknown): GameState | null {
  if (!isRecord(raw)) return null;

  const yawns = parseDecimal(raw.yawns);
  const totalYawns = parseDecimal(raw.totalYawns);
  if (!yawns || !totalYawns) return null;
  if (!isNonNegInt(raw.clicks) || !isNonNegInt(raw.rngSeed) || raw.rngSeed > 0xffffffff) return null;
  if (!isNonNegNumber(raw.playTimeMs)) return null;
  if (!isNonNegNumber(raw.createdAt) || !isNonNegNumber(raw.lastSavedAt)) return null;
  if (typeof raw.tainted !== 'boolean') return null;
  if (raw.awakenedAt !== null && !isNonNegNumber(raw.awakenedAt)) return null;
  const awakenedAt = raw.awakenedAt;

  const settings = raw.settings;
  if (
    !isRecord(settings) ||
    !isNotation(settings.notation) ||
    !isBuyAmount(settings.buyAmount) ||
    typeof settings.autoBuy !== 'boolean' ||
    typeof settings.autoUpgrade !== 'boolean' ||
    !isRecord(settings.autoPrestige) ||
    typeof settings.autoPrestige.enabled !== 'boolean' ||
    !AUTO_PRESTIGE_RATIOS.some((r) => r === (settings.autoPrestige as Record<string, unknown>).ratio) ||
    !THEMES.some((th) => th === settings.theme) ||
    typeof settings.effects !== 'boolean' ||
    !isVolume(settings.volume) ||
    !AUTOSAVE_SECONDS.some((sec) => sec === settings.autosaveSec)
  ) {
    return null;
  }

  const prestige = parsePrestige(raw.prestige);
  const minigames = parseMinigames(raw.minigames);
  const hibernation = parseHibernation(raw.hibernation);
  const challenges = parseChallenges(raw.challenges);
  if (!prestige || !minigames || !hibernation || !challenges) return null;

  const producersRaw = raw.producers;
  if (!isRecord(producersRaw)) return null;
  const producers = createProducerStates();
  for (const id of PRODUCER_IDS) {
    const entry = producersRaw[id];
    // 新しく増えた生産者は 0 体として扱う
    if (entry === undefined) continue;
    if (!isRecord(entry) || !isNonNegInt(entry.bought)) return null;
    const infected = parseDecimal(entry.infected);
    if (!infected) return null;
    producers[id].bought = entry.bought;
    producers[id].infected = infected;
  }

  const upgradesRaw = raw.upgrades;
  if (!Array.isArray(upgradesRaw) || !upgradesRaw.every((u) => typeof u === 'string')) return null;
  // 知らない ID（削除されたアップグレードなど）は読み飛ばす
  const upgrades = new Set(upgradesRaw.filter((u: string) => UPGRADE_BY_ID.has(u)));

  const achievementsRaw = raw.achievements;
  if (!isRecord(achievementsRaw)) return null;
  const achievements = new Map<string, number>();
  for (const [id, at] of Object.entries(achievementsRaw)) {
    if (!isNonNegNumber(at)) return null;
    // 知らない ID（削除された実績など）は読み飛ばす
    if (ACHIEVEMENT_BY_ID.has(id)) achievements.set(id, at);
  }

  const lifetimeRaw = raw.lifetime;
  if (!isRecord(lifetimeRaw)) return null;
  const lifetimeYawns = parseDecimal(lifetimeRaw.yawns);
  if (
    !lifetimeYawns ||
    !isNonNegInt(lifetimeRaw.clicks) ||
    !isNonNegNumber(lifetimeRaw.playTimeMs) ||
    !isNonNegInt(lifetimeRaw.stars)
  ) {
    return null;
  }

  const stars = parseStars(raw.stars);
  const buffs = parseBuffs(raw.buffs);
  if (!stars || !buffs) return null;

  return {
    yawns,
    totalYawns,
    clicks: raw.clicks,
    producers,
    upgrades,
    achievements,
    lifetime: {
      yawns: lifetimeYawns,
      clicks: lifetimeRaw.clicks,
      playTimeMs: lifetimeRaw.playTimeMs,
      stars: lifetimeRaw.stars,
    },
    stars,
    buffs,
    prestige,
    hibernation,
    challenges,
    minigames,
    rngSeed: raw.rngSeed,
    playTimeMs: raw.playTimeMs,
    createdAt: raw.createdAt,
    lastSavedAt: raw.lastSavedAt,
    settings: {
      notation: settings.notation,
      buyAmount: settings.buyAmount,
      autoBuy: settings.autoBuy,
      autoUpgrade: settings.autoUpgrade,
      autoPrestige: { enabled: settings.autoPrestige.enabled as boolean, ratio: settings.autoPrestige.ratio as number },
      theme: settings.theme as Theme,
      effects: settings.effects,
      volume: settings.volume,
      autosaveSec: settings.autosaveSec as AutosaveSeconds,
    },
    awakenedAt,
    tainted: raw.tainted,
  };
}
