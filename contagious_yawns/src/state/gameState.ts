import Decimal from 'break_eternity.js';
import { PRODUCER_IDS, type ProducerId } from '../data/producers';
import { LOTTERY } from '../data/lottery';
import { PILLOWS } from '../data/minigames';
import { STARS, type StarEffectId } from '../data/stars';

/** セーブデータのスキーマ版。上げるときは save/migrations.ts にマイグレーションを書く。 */
export const SCHEMA_VERSION = 12;

export const NOTATIONS = ['ja', 'en', 'sci'] as const;
export type Notation = (typeof NOTATIONS)[number];

export const BUY_AMOUNTS = [1, 10, 100, 'max'] as const;

/** オートおやすみの条件（累計のかけらに対して、得られるかけらが何倍以上なら） */
export const AUTO_PRESTIGE_RATIOS = [0.25, 0.5, 1, 2] as const;
export type BuyAmount = (typeof BUY_AMOUNTS)[number];

/** 画面の色：auto は OS の設定に合わせる */
export const THEMES = ['auto', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** 自動セーブの間隔（秒） */
export const AUTOSAVE_SECONDS = [10, 30, 60, 120] as const;
export type AutosaveSeconds = (typeof AUTOSAVE_SECONDS)[number];

/** 音量（0〜100）の刻み */
export const VOLUME_STEP = 10;

/** 表示・音の設定の初期値（v10 → v11 のマイグレーションでも使う） */
export const DEFAULT_DISPLAY_SETTINGS = {
  theme: 'auto',
  effects: true,
  volume: 50,
  autosaveSec: 30,
} as const satisfies Pick<Settings, 'theme' | 'effects' | 'volume' | 'autosaveSec'>;

export interface ProducerState {
  /** 購入した数（価格計算に使う） */
  bought: number;
  /** 眠気の連鎖でうつった数（生産量には使うが、価格には使わない） */
  infected: Decimal;
}

export interface Settings {
  notation: Notation;
  buyAmount: BuyAmount;
  /** 自動購入（夢ツリーで解放）を使うか */
  autoBuy: boolean;
  /** 自動アップグレード（夢ツリーで解放）を使うか */
  autoUpgrade: boolean;
  /** オートおやすみ（ぬくもりショップで解放）：得られるかけら ≥ 累計のかけら × ratio のとき自動でおやすみ */
  autoPrestige: { enabled: boolean; ratio: number };
  theme: Theme;
  /** 演出（浮かぶ数字・パーティクル・画面の切り替え）を出すか */
  effects: boolean;
  /** 効果音の音量 0〜100（VOLUME_STEP 刻み）。0 なら鳴らさない */
  volume: number;
  autosaveSec: AutosaveSeconds;
}

/** チャレンジ「眠れない夜」（DESIGN.md §7）。 */
export interface ChallengeState {
  /** 挑戦中のチャレンジ ID */
  active: string | null;
  /** クリアしたチャレンジ ID */
  completed: Set<string>;
}

/** 第1層「おやすみ」の状態。おやすみしても消えない。 */
export interface PrestigeState {
  /** 手持ちの夢のかけら */
  shards: number;
  /** これまでに得た夢のかけらの合計（受動ボーナスに使う。使っても減らない） */
  shardsLifetime: number;
  /** おやすみした回数 */
  count: number;
  /** 解放した夢ツリーのノード ID */
  nodes: Set<string>;
  /** 夢の続き（何度でも解放できるノード）の段階。冬眠で 0 に戻る */
  encore: number;
}

/** 周回（プレステージ）をまたいで残る記録。 */
export interface LifetimeStats {
  yawns: Decimal;
  clicks: number;
  playTimeMs: number;
  /** 拾った流れ星の数 */
  stars: number;
}

/** 画面に出ている流れ星。効果と位置は出た時点で決まっている（リロードしても変わらない）。 */
export interface ActiveStar {
  effect: StarEffectId;
  /** 画面に対する位置（0〜1） */
  x: number;
  y: number;
  remainingMs: number;
}

export interface StarState {
  /** 次の流れ星までの残り時間（画面を見ているあいだだけ減る） */
  timerMs: number;
  active: ActiveStar | null;
  /** この周回で拾った数 */
  clicked: number;
}

export const BUFF_KINDS = ['production', 'click'] as const;
export type BuffKind = (typeof BUFF_KINDS)[number];

/** 一時的な倍率の出どころ：流れ星の効果か、羊を数える・夢くじ。 */
export type BuffSource = StarEffectId | 'sheep' | 'lottery';

/** 一時的な倍率（流れ星の効果など）。 */
export interface Buff {
  kind: BuffKind;
  factor: number;
  remainingMs: number;
  source: BuffSource;
}

/** 第2層「冬眠」の状態（DESIGN.md §6.2）。冬眠しても消えない。季節は count から決まる。 */
export interface HibernationState {
  /** 手持ちのぬくもり */
  warmth: number;
  /** これまでに得たぬくもり（受動ボーナスに使う） */
  warmthLifetime: number;
  /** 冬眠した回数 */
  count: number;
  /** ぬくもりショップで買ったもの */
  shop: Set<string>;
}

/** 夢くじ（DESIGN.md §16）。おやすみ・冬眠しても消えない（runPlays だけ周回ごと）。 */
export interface LotteryState {
  /** 夢くじの券（おやすみ1回で1枚） */
  tickets: number;
  /** 引いた回数（全期間） */
  plays: number;
  /** この周回で引いた回数（整合性チェック用） */
  runPlays: number;
  /** 3つそろった回数 */
  jackpots: number;
  /** 引いている途中の回。holds[i] は i 回目の回し直しで残したリール。リロードしても続きから */
  active: { seed: number; holds: boolean[][] } | null;
}

/** ミニゲーム（DESIGN.md §10）。おやすみしても消えない（sheepRunPlays だけ周回ごと）。 */
export interface MinigameState {
  /** チケット「まくら」 */
  pillows: number;
  /** 次のまくらまでの残り時間（満タンのあいだは止まる） */
  pillowTimerMs: number;
  /** 羊を数えた回数（全期間） */
  sheepPlays: number;
  /** この周回で羊を数えた回数（整合性チェック用） */
  sheepRunPlays: number;
  sheepBest: number;
  /** 図鑑に登録しためずらしい羊 */
  collection: Set<string>;
  /** 遊んでいる途中の回（費用は払い済み。リロードしたら無効になる） */
  active: { seed: number } | null;
  lottery: LotteryState;
}

/** ゲームの状態はすべてここに集約する（SPEC §3 鉄則4）。 */
export interface GameState {
  /** 手持ちのあくび */
  yawns: Decimal;
  /** この周回で獲得したあくびの累計 */
  totalYawns: Decimal;
  /** この周回のクリック数 */
  clicks: number;
  producers: Record<ProducerId, ProducerState>;
  /** 購入済みアップグレードの ID */
  upgrades: Set<string>;
  /** 解除済みの実績 ID → 解除した時刻 */
  achievements: Map<string, number>;
  lifetime: LifetimeStats;
  stars: StarState;
  buffs: Buff[];
  prestige: PrestigeState;
  hibernation: HibernationState;
  challenges: ChallengeState;
  minigames: MinigameState;
  /** シード付き PRNG の現在値（SPEC §3 鉄則5） */
  rngSeed: number;
  /** この周回のプレイ時間（オフラインで数えた時間も含む） */
  playTimeMs: number;
  createdAt: number;
  lastSavedAt: number;
  settings: Settings;
  /** めざめ（エンディング）を見た時刻。まだなら null（DESIGN.md §6.3） */
  awakenedAt: number | null;
  /** 改造の疑いがあるデータ。一度立つと消えない（SPEC §6.3-3） */
  tainted: boolean;
}

export function createProducerStates(): Record<ProducerId, ProducerState> {
  return Object.fromEntries(PRODUCER_IDS.map((id) => [id, { bought: 0, infected: new Decimal(0) }])) as Record<
    ProducerId,
    ProducerState
  >;
}

export function createInitialState(now: number, seed: number): GameState {
  return {
    yawns: new Decimal(0),
    totalYawns: new Decimal(0),
    clicks: 0,
    producers: createProducerStates(),
    upgrades: new Set(),
    achievements: new Map(),
    lifetime: { yawns: new Decimal(0), clicks: 0, playTimeMs: 0, stars: 0 },
    stars: { timerMs: STARS.firstIntervalMs, active: null, clicked: 0 },
    buffs: [],
    prestige: { shards: 0, shardsLifetime: 0, count: 0, nodes: new Set(), encore: 0 },
    hibernation: { warmth: 0, warmthLifetime: 0, count: 0, shop: new Set() },
    challenges: { active: null, completed: new Set() },
    minigames: {
      pillows: PILLOWS.max,
      pillowTimerMs: PILLOWS.regenMs,
      sheepPlays: 0,
      sheepRunPlays: 0,
      sheepBest: 0,
      collection: new Set(),
      active: null,
      lottery: createLotteryState(0),
    },
    rngSeed: seed >>> 0,
    playTimeMs: 0,
    createdAt: now,
    lastSavedAt: now,
    settings: {
      notation: 'ja',
      buyAmount: 1,
      autoBuy: true,
      autoUpgrade: true,
      autoPrestige: { enabled: false, ratio: AUTO_PRESTIGE_RATIOS[1] },
      ...DEFAULT_DISPLAY_SETTINGS,
    },
    awakenedAt: null,
    tainted: false,
  };
}

/** 夢くじの初期状態（tickets 枚の券から始める。v11 → v12 のマイグレーションでも使う）。 */
export function createLotteryState(tickets: number): LotteryState {
  return { tickets: Math.min(LOTTERY.ticketsMax, tickets), plays: 0, runPlays: 0, jackpots: 0, active: null };
}
