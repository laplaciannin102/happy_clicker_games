/** 経済まわりの基本数値（DESIGN.md §3〜§4）。 */
export const ECONOMY = {
  /** 生産者の価格倍率：基本価格 × priceGrowth^購入数 */
  priceGrowth: 1.15,
  /** 1クリックで得るあくび */
  clickBase: 1,
  /** 前の生産者を1体持ち、累計あくびが基本価格のこの割合に達したら表示する */
  revealRatio: 0.5,
} as const;

/** 眠気の連鎖（DESIGN.md §3.1）。1体が毎秒、ひとつ前の生産者を何体うつすか。 */
export const CHAIN = {
  rate: 0.02,
} as const;

/** 時間まわりの数値。 */
export const TIMING = {
  /** 固定タイムステップ（ミリ秒） */
  tickMs: 50,
  /** 描画の最短間隔（ミリ秒） */
  renderMs: 100,
  /** クリック受付の上限（回/秒）。押しっぱなしや連打ツール対策 */
  maxClicksPerSec: 20,
  /** これ以上あいたら（タブ復帰など）一括処理に切り替える（ミリ秒） */
  catchUpThresholdMs: 1_000,
} as const;

/**
 * オフライン進行（DESIGN.md §11.2）。
 * ページを閉じていた時間と、開いたまま止まっていた（PC のスリープなど）時間が対象。
 * 上限はひと晩の睡眠時間。それ以上だと「毎日開く理由」が弱くなるため。
 */
export const OFFLINE = {
  /** 数える時間の上限 */
  capMs: 8 * 60 * 60_000,
  /** 生産の効率（通常の何倍か） */
  efficiency: 0.5,
  /** 開いたままでも、これ以上止まっていたらオフライン扱いにする。短い停止は通常どおり全部数える */
  pausedThresholdMs: 5 * 60_000,
  /** これより短い不在では「おかえりなさい」を出さない */
  noticeMinMs: 60_000,
} as const;
