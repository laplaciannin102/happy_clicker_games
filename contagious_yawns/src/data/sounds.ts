/** 1つの音（Web Audio のオシレーター1本）。時間は秒、音の高さは Hz。 */
export interface Tone {
  readonly wave: OscillatorType;
  readonly freq: number;
  /** 鳴り終わりの高さ（なめらかに変える）。なければ一定 */
  readonly slideTo?: number;
  /** 効果音の頭からの遅れ */
  readonly at: number;
  readonly dur: number;
  /** 最大の大きさ 0〜1（音量の設定を掛ける前） */
  readonly gain: number;
}

export const SOUND_IDS = [
  'click',
  'buy',
  'upgrade',
  'denied',
  'digitUp',
  'achievement',
  'starAppear',
  'starCatch',
  'prestige',
  'hibernate',
  'challengeClear',
  'sheepJump',
  'lotterySpin',
  'lotteryWin',
  'awaken',
] as const;
export type SoundId = (typeof SOUND_IDS)[number];

/** ねむたい音：やわらかい波形（sine / triangle）で、高すぎない音域にする（DESIGN.md §14）。 */
export const SOUNDS: Readonly<Record<SoundId, readonly Tone[]>> = {
  // ぽふっ（クリック。高さは SOUND.clickPitchJitter で少し揺らす）
  click: [{ wave: 'sine', freq: 520, slideTo: 300, at: 0, dur: 0.09, gain: 0.35 }],
  buy: [
    { wave: 'triangle', freq: 660, at: 0, dur: 0.08, gain: 0.3 },
    { wave: 'triangle', freq: 880, at: 0.06, dur: 0.1, gain: 0.25 },
  ],
  upgrade: [
    { wave: 'triangle', freq: 523, at: 0, dur: 0.1, gain: 0.3 },
    { wave: 'triangle', freq: 659, at: 0.08, dur: 0.1, gain: 0.3 },
    { wave: 'triangle', freq: 784, at: 0.16, dur: 0.16, gain: 0.3 },
  ],
  denied: [{ wave: 'sine', freq: 220, slideTo: 180, at: 0, dur: 0.12, gain: 0.25 }],
  // 桁が増えた：ふわっと上がる
  digitUp: [
    { wave: 'sine', freq: 392, slideTo: 784, at: 0, dur: 0.35, gain: 0.25 },
    { wave: 'sine', freq: 1175, at: 0.25, dur: 0.3, gain: 0.12 },
  ],
  achievement: [
    { wave: 'triangle', freq: 784, at: 0, dur: 0.14, gain: 0.3 },
    { wave: 'triangle', freq: 988, at: 0.1, dur: 0.14, gain: 0.3 },
    { wave: 'triangle', freq: 1319, at: 0.2, dur: 0.3, gain: 0.25 },
  ],
  // 流れ星：小さく、きらっと
  starAppear: [
    { wave: 'sine', freq: 1568, at: 0, dur: 0.12, gain: 0.12 },
    { wave: 'sine', freq: 2093, at: 0.08, dur: 0.2, gain: 0.1 },
  ],
  starCatch: [
    { wave: 'sine', freq: 1047, at: 0, dur: 0.1, gain: 0.25 },
    { wave: 'sine', freq: 1319, at: 0.07, dur: 0.1, gain: 0.25 },
    { wave: 'sine', freq: 1568, at: 0.14, dur: 0.1, gain: 0.25 },
    { wave: 'sine', freq: 2093, at: 0.21, dur: 0.3, gain: 0.2 },
  ],
  // おやすみ：ゆっくり下がる子守歌
  prestige: [
    { wave: 'sine', freq: 784, at: 0, dur: 0.45, gain: 0.25 },
    { wave: 'sine', freq: 659, at: 0.4, dur: 0.45, gain: 0.25 },
    { wave: 'sine', freq: 523, at: 0.8, dur: 0.9, gain: 0.25 },
  ],
  hibernate: [
    { wave: 'sine', freq: 392, at: 0, dur: 0.6, gain: 0.25 },
    { wave: 'sine', freq: 330, at: 0.5, dur: 0.6, gain: 0.25 },
    { wave: 'sine', freq: 262, at: 1, dur: 1.2, gain: 0.25 },
    { wave: 'triangle', freq: 131, at: 1, dur: 1.2, gain: 0.15 },
  ],
  challengeClear: [
    { wave: 'triangle', freq: 523, at: 0, dur: 0.12, gain: 0.3 },
    { wave: 'triangle', freq: 659, at: 0.1, dur: 0.12, gain: 0.3 },
    { wave: 'triangle', freq: 784, at: 0.2, dur: 0.12, gain: 0.3 },
    { wave: 'triangle', freq: 1047, at: 0.3, dur: 0.4, gain: 0.3 },
  ],
  // 羊がさくを跳ぶ
  sheepJump: [{ wave: 'triangle', freq: 440, slideTo: 660, at: 0, dur: 0.12, gain: 0.25 }],
  // 夢くじ：くるくる回る
  lotterySpin: [
    { wave: 'triangle', freq: 392, at: 0, dur: 0.06, gain: 0.2 },
    { wave: 'triangle', freq: 494, at: 0.07, dur: 0.06, gain: 0.2 },
    { wave: 'triangle', freq: 587, at: 0.14, dur: 0.06, gain: 0.2 },
    { wave: 'triangle', freq: 494, at: 0.21, dur: 0.08, gain: 0.2 },
  ],
  // 夢くじ：そろった
  lotteryWin: [
    { wave: 'sine', freq: 659, at: 0, dur: 0.15, gain: 0.28 },
    { wave: 'sine', freq: 784, at: 0.12, dur: 0.15, gain: 0.28 },
    { wave: 'sine', freq: 988, at: 0.24, dur: 0.5, gain: 0.25 },
  ],
  // めざめ：夜明けの和音がゆっくり上がる
  awaken: [
    { wave: 'sine', freq: 262, at: 0, dur: 1.6, gain: 0.2 },
    { wave: 'sine', freq: 330, at: 0.4, dur: 1.4, gain: 0.2 },
    { wave: 'sine', freq: 392, at: 0.8, dur: 1.2, gain: 0.2 },
    { wave: 'sine', freq: 523, at: 1.2, dur: 1.4, gain: 0.22 },
  ],
};

export const SOUND = {
  /** 全体の大きさ（音量 100% のとき）。小さめにしておく */
  masterGain: 0.5,
  /** クリック音の高さの揺らぎ（±この割合） */
  clickPitchJitter: 0.08,
  /** 立ち上がり（プチッという音を防ぐ） */
  attack: 0.01,
  /** 同じ音をこれより短い間隔では重ねない（連打・自動購入でうるさくならないように） */
  minGapMs: 40,
} as const;
