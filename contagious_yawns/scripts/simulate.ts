import { DREAM_NODES } from '../src/data/prestige';
import { PRODUCERS, type ProducerDef } from '../src/data/producers';
import { fromPayload, toPayload } from '../src/save/payload';
import { createInitialState, type GameState } from '../src/state/gameState';
import { checkAchievements } from '../src/systems/achievements';
import { createAutomation } from '../src/systems/automation';
import { tickBuffs } from '../src/systems/buffs';
import { checkChallenge } from '../src/systems/challenges';
import { performClick } from '../src/systems/click';
import { WARMTH_SHOP } from '../src/data/hibernation';
import { buyEncore, buyNode, nodeStatus } from '../src/systems/dreamTree';
import { buyWarmthItem, doHibernate, warmthForNow } from '../src/systems/hibernation';
import { doPrestige, shardsForRun } from '../src/systems/prestige';
import { produce, rateEach, totalRate } from '../src/systems/production';
import { buyProducer, priceMultiplier, unitPrice } from '../src/systems/purchase';
import { catchStar, tickStars } from '../src/systems/stars';
import { producerVisibility } from '../src/systems/unlock';
import { buyUpgrade, visibleUpgrades } from '../src/systems/upgrades';

/**
 * バランスシミュレーター（SPEC §4.3）。「最適っぽく」買い続けるボットで、各マイルストーンの到達時間を測る。
 * DOM には触らない。ゲーム本体と同じ systems/ の関数だけを使う。
 */
export interface BotOptions {
  /** 何秒ぶん遊ぶか */
  seconds: number;
  /** 毎秒のクリック数（放置プレイなら 0） */
  clicksPerSec: number;
  /** 流れ星を拾うか（画面を見ているか） */
  watchStars: boolean;
  /** おやすみする条件：得られるかけら ≥ max(minShards, 累計のかけら × growth) */
  prestige: { minShards: number; growth: number } | null;
  /** 冬眠できるようになったらすぐ冬眠するか */
  hibernate?: boolean;
  /** 1ステップの秒数（小さいほど正確で遅い） */
  dt?: number;
  seed?: number;
  /** 実時間の上限（ミリ秒）。超えたらそこまでの結果で止める */
  maxWallMs?: number;
  /** 途中の状態から始める（そのまま書き換える） */
  initial?: GameState;
  /** true を返したらそこで止める（ゲーム内の時刻を stoppedAt に入れる） */
  stopWhen?: (s: GameState) => boolean;
}

export interface PrestigeRecord {
  /** 開始からの秒数 */
  at: number;
  /** その周回にかかった秒数 */
  runSec: number;
  shards: number;
  /** おやすみしたときの周回の累計と毎秒の生産 */
  total: string;
  rate: string;
}

export interface BotResult {
  state: GameState;
  /** 生産者が初めて表示された・買われた時刻（秒、最初の周回） */
  firstSeen: Record<string, number>;
  firstBought: Record<string, number>;
  /** おやすみが初めてできるようになった時刻 */
  firstPrestigeReady: number | null;
  prestiges: PrestigeRecord[];
  /** 夢ツリーを半分・全部解放した時刻 */
  treeHalfAt: number | null;
  treeFullAt: number | null;
  /** 夢ツリーの各ノードを解放した時刻（いちばん最初） */
  nodeAt: Record<string, number>;
  /** 冬眠した時刻とぬくもり */
  hibernations: { at: number; warmth: number }[];
  /** 実時間の上限で止めたときの、ゲーム内の時刻（止めていなければ null） */
  stoppedAt: number | null;
  /** かかった実時間（ミリ秒） */
  wallMs: number;
}

/** 1ステップで1体ずつ買う回数の上限（これを超えたら「買えるだけ」買う） */
const BUYS_PER_STEP = 25;

/** 表示されている生産者のうち、回収時間（価格 ÷ 1体の生産量）がいちばん短いもの。 */
function bestProducer(s: GameState): ProducerDef | undefined {
  const vis = producerVisibility(s);
  let best: ProducerDef | undefined;
  let bestScore = Infinity;
  for (const def of PRODUCERS) {
    if (vis[def.id] !== 'visible') continue;
    const score = unitPrice(def, s.producers[def.id].bought, priceMultiplier(s)).div(rateEach(s, def.id)).toNumber();
    if (score < bestScore) {
      best = def;
      bestScore = score;
    }
  }
  return best;
}

/** 夢のかけらを、買えるノードのうち安いものから使う。ツリーを埋めたら夢の続きを買う。解放したノードの ID を返す。 */
function spendShards(s: GameState): string[] {
  const bought: string[] = [];
  for (;;) {
    const next = DREAM_NODES.filter((n) => nodeStatus(s, n) === 'available' && n.cost <= s.prestige.shards).sort(
      (a, b) => a.cost - b.cost,
    )[0];
    if (!next || !buyNode(s, next.id)) break;
    bought.push(next.id);
  }
  while (buyEncore(s)) bought.push('encore');
  return bought;
}

export function runBot(options: BotOptions): BotResult {
  const dt = options.dt ?? 0.1;
  const s = options.initial ?? createInitialState(0, options.seed ?? 1);
  const automation = createAutomation();
  const result: BotResult = {
    state: s,
    firstSeen: {},
    firstBought: {},
    firstPrestigeReady: null,
    prestiges: [],
    treeHalfAt: null,
    treeFullAt: null,
    nodeAt: {},
    hibernations: [],
    stoppedAt: null,
    wallMs: 0,
  };
  const wallStart = Date.now();
  const half = Math.ceil(DREAM_NODES.length / 2);
  let clickTimer = 0;
  let runStart = 0;
  let step = 0;

  for (let time = 0; time <= options.seconds; time += dt, step++) {
    if (options.maxWallMs !== undefined && step % 1000 === 0 && Date.now() - wallStart > options.maxWallMs) {
      result.stoppedAt = time;
      break;
    }
    if (options.clicksPerSec > 0) {
      clickTimer += dt;
      while (clickTimer >= 1 / options.clicksPerSec) {
        performClick(s);
        clickTimer -= 1 / options.clicksPerSec;
      }
    }
    produce(s, dt);
    tickBuffs(s, dt * 1000);
    tickStars(s, dt * 1000, options.watchStars);
    if (options.watchStars && s.stars.active) catchStar(s);
    automation.tick(s, dt * 1000);
    if (step % Math.round(1 / dt) === 0) {
      checkAchievements(s, time * 1000);
      checkChallenge(s);
      if (options.stopWhen?.(s)) {
        result.stoppedAt = time;
        break;
      }
    }

    if (s.prestige.count === 0) {
      const vis = producerVisibility(s);
      for (const def of PRODUCERS) if (vis[def.id] === 'visible') result.firstSeen[def.id] ??= time;
    }
    for (const { def, status } of visibleUpgrades(s)) {
      if (status === 'available') buyUpgrade(s, def.id);
    }
    // 1体ずつ回収時間のいちばん短いものを買う。終盤はあくびが桁違いに多く、1体ずつだと何千回も回って遅いので、
    // 1ステップで BUYS_PER_STEP 回を超えたら、そのときいちばんよいものを「買えるだけ」買って次へ進む
    let target = bestProducer(s);
    let buys = 0;
    while (target && buyProducer(s, target.id, buys < BUYS_PER_STEP ? 1 : 'max') > 0) {
      if (s.prestige.count === 0) result.firstBought[target.id] ??= time;
      if (++buys > BUYS_PER_STEP) break;
      target = bestProducer(s);
    }

    const gain = shardsForRun(s);
    if (gain > 0) result.firstPrestigeReady ??= time;
    const policy = options.prestige;
    if (policy && gain > 0 && gain >= Math.max(policy.minShards, s.prestige.shardsLifetime * policy.growth)) {
      const total = s.totalYawns.toExponential(2);
      const rate = totalRate(s).toExponential(2);
      doPrestige(s);
      result.prestiges.push({ at: time, runSec: time - runStart, shards: gain, total, rate });
      runStart = time;
      for (const id of spendShards(s)) result.nodeAt[id] ??= time;
      if (s.prestige.nodes.size >= half) result.treeHalfAt ??= time;
      if (s.prestige.nodes.size >= DREAM_NODES.length) result.treeFullAt ??= time;
    }

    // 夢ツリーを埋めていて、ぬくもりが1つ以上もらえるなら冬眠し、ぬくもりショップを安い順に買う
    if (options.hibernate && warmthForNow(s) > 0) {
      const warmth = doHibernate(s);
      result.hibernations.push({ at: time, warmth });
      runStart = time;
      // ボットは自分でおやすみの時期を決めるので、オートおやすみは買わない
      for (const w of [...WARMTH_SHOP].sort((a, b) => a.cost - b.cost)) {
        if (w.effect.kind !== 'autoPrestige') buyWarmthItem(s, w.id);
      }
    }
  }
  result.wallMs = Date.now() - wallStart;
  return result;
}

/** 状態を丸ごと複製する（セーブと同じ変換を通す） */
export function cloneState(s: GameState): GameState {
  const copy = fromPayload(JSON.parse(JSON.stringify(toPayload(s))));
  if (!copy) throw new Error('cloneState failed');
  return copy;
}

const minutes = (sec: number | null | undefined): string =>
  sec === null || sec === undefined ? '-' : `${(sec / 60).toFixed(1)}分`;

/** 結果を表（Markdown）にする。BALANCE.md に貼る用。 */
export function formatReport(title: string, r: BotResult): string {
  const lines = [`### ${title}`, '', '| 生産者 | 表示 | 初購入 |', '|---|---|---|'];
  for (const def of PRODUCERS) {
    lines.push(`| ${def.id} | ${minutes(r.firstSeen[def.id])} | ${minutes(r.firstBought[def.id])} |`);
  }
  lines.push('', `- 初回おやすみ可能：${minutes(r.firstPrestigeReady)}`);
  r.prestiges.slice(0, 8).forEach((p, i) => {
    lines.push(
      `- ${i + 1}回目のおやすみ：${minutes(p.at)}（この周 ${minutes(p.runSec)}、+${p.shards} かけら、累計 ${p.total}、毎秒 ${p.rate}）`,
    );
  });
  if (r.prestiges.length > 8) lines.push(`- …計 ${r.prestiges.length} 回`);
  lines.push(
    `- 夢ツリー半分：${minutes(r.treeHalfAt)} / 全部：${minutes(r.treeFullAt)} / 眠気の連鎖：${minutes(r.nodeAt.chain)}`,
    `- 冬眠：${r.hibernations.length === 0 ? '-' : r.hibernations.map((h) => `${minutes(h.at)}（+${h.warmth}）`).join(' → ')}`,
    r.stoppedAt === null ? '' : `- ⚠ 実時間の上限で ${minutes(r.stoppedAt)} の時点で止めた`,
    `- 実時間 ${(r.wallMs / 1000).toFixed(0)}秒`,
    `- 終了時：累計のかけら ${r.state.prestige.shardsLifetime}、ノード ${r.state.prestige.nodes.size}/${DREAM_NODES.length}、実績 ${r.state.achievements.size}`,
  );
  return lines.join('\n');
}
