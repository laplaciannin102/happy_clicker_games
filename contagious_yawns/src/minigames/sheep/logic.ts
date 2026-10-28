import { mulberry32 } from '../../core/rng';
import { RARE_SHEEP, SHEEP_GAME, SHEEP_KINDS, type RareSheepId, type SheepKind } from '../../data/minigames';

/** 1匹の羊。atMs＝柵の上に来る時刻（開始からの経過）。 */
export interface Sheep {
  kind: SheepKind;
  atMs: number;
  /** めずらしい羊のときの種類 */
  rare?: RareSheepId;
}

/** その羊を数えてよいか（黒い羊と、跳ぶふりの羊はだめ）。 */
export function isCountable(sheep: Sheep): boolean {
  return sheep.kind !== 'black' && sheep.kind !== 'feint';
}

/** シードから羊の並びを作る。同じシードなら必ず同じ並びになる（SPEC §5）。 */
export function generateSheep(seed: number): Sheep[] {
  let s = seed >>> 0;
  const rand = (): number => {
    const r = mulberry32(s);
    s = r.next;
    return r.value;
  };
  const totalWeight = SHEEP_KINDS.reduce((sum, k) => sum + SHEEP_GAME.weights[k], 0);
  const out: Sheep[] = [];
  for (let at = SHEEP_GAME.firstAtMs; at <= SHEEP_GAME.durationMs - SHEEP_GAME.tailMs; ) {
    let r = rand() * totalWeight;
    let kind: SheepKind = 'normal';
    for (const k of SHEEP_KINDS) {
      r -= SHEEP_GAME.weights[k];
      if (r < 0) {
        kind = k;
        break;
      }
    }
    const sheep: Sheep = { kind, atMs: Math.round(at) };
    if (kind === 'rare') sheep.rare = RARE_SHEEP[Math.floor(rand() * RARE_SHEEP.length)] ?? 'gold';
    out.push(sheep);
    at += SHEEP_GAME.minGapMs + rand() * (SHEEP_GAME.maxGapMs - SHEEP_GAME.minGapMs);
  }
  return out;
}

export interface SheepResult {
  /** 正しく数えた数 */
  counted: number;
  /** 数え間違い（黒い羊・跳ぶふり・何もいないとき） */
  mistakes: number;
  /** 数えためずらしい羊 */
  rares: RareSheepId[];
  /** 黒い羊を数えた数（隠し実績用） */
  blackCounted: number;
}

/**
 * 1回の押下を、まだ判定していない羊のうち柵の上（±windowMs）にいるいちばん近いものに当てる。
 * 当たった羊の番号を used に足して返す。何もいなければ -1。画面のその場の反応にも使う。
 */
export function matchPress(sheep: readonly Sheep[], used: Set<number>, t: number): number {
  let best = -1;
  let bestDist = Infinity;
  sheep.forEach((sh, i) => {
    const d = Math.abs(sh.atMs - t);
    if (!used.has(i) && d <= SHEEP_GAME.windowMs && d < bestDist) {
      best = i;
      bestDist = d;
    }
  });
  if (best >= 0) used.add(best);
  return best;
}

/** 押した時刻の列を判定する。同じ羊は1回しか数えない。何もいなければ数え間違い。 */
export function judge(sheep: readonly Sheep[], pressesMs: readonly number[]): SheepResult {
  const used = new Set<number>();
  const result: SheepResult = { counted: 0, mistakes: 0, rares: [], blackCounted: 0 };
  for (const t of pressesMs) {
    const best = matchPress(sheep, used, t);
    const hit = sheep[best];
    if (!hit) {
      result.mistakes += 1;
      continue;
    }
    if (isCountable(hit)) {
      result.counted += 1;
      if (hit.rare) result.rares.push(hit.rare);
    } else {
      result.mistakes += 1;
      if (hit.kind === 'black') result.blackCounted += 1;
    }
  }
  return result;
}

/** スコア＝正しく数えた数 − 数え間違い（0 未満にしない）。 */
export function score(result: SheepResult): number {
  return Math.max(0, result.counted - result.mistakes);
}

/** スコアに対するクリック倍率（上限つき）。 */
export function rewardFactor(points: number): number {
  return Math.min(SHEEP_GAME.maxFactor, 1 + SHEEP_GAME.perScore * points);
}
