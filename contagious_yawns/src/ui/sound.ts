import { SOUND, SOUNDS, type SoundId, type Tone } from '../data/sounds';

export interface SoundPlayer {
  play(id: SoundId): void;
  /** 0〜100 */
  setVolume(volume: number): void;
}

/** 音量 0〜100 を、実際に掛ける大きさにする（耳の感じ方に合わせて2乗）。 */
export function volumeGain(volume: number): number {
  const v = Math.min(100, Math.max(0, volume)) / 100;
  return v * v * SOUND.masterGain;
}

/**
 * 効果音（Web Audio でその場で作る。音声ファイルは使わない）。
 * ブラウザは操作のあとでないと音を出せないので、AudioContext は最初に鳴らすときに作る。
 */
export function createSoundPlayer(initialVolume: number): SoundPlayer {
  let volume = initialVolume;
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  const lastPlayed = new Map<SoundId, number>();

  function ensureContext(): AudioContext | null {
    if (ctx) return ctx;
    if (typeof AudioContext === 'undefined') return null;
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = volumeGain(volume);
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(audio: AudioContext, out: GainNode, t: Tone, start: number, pitch: number): void {
    const osc = audio.createOscillator();
    const env = audio.createGain();
    const t0 = start + t.at;
    const t1 = t0 + t.dur;
    osc.type = t.wave;
    osc.frequency.setValueAtTime(t.freq * pitch, t0);
    if (t.slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(t.slideTo * pitch, t1);
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(t.gain, t0 + SOUND.attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.connect(env).connect(out);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  }

  return {
    play(id) {
      if (volume <= 0) return;
      const now = performance.now();
      if (now - (lastPlayed.get(id) ?? -Infinity) < SOUND.minGapMs) return;
      lastPlayed.set(id, now);
      const audio = ensureContext();
      if (!audio || !master) return;
      if (audio.state === 'suspended') void audio.resume();
      // 見た目・音だけの揺らぎなので、ゲーム用のシード付き乱数は使わない
      const pitch = id === 'click' ? 1 + (Math.random() * 2 - 1) * SOUND.clickPitchJitter : 1;
      for (const t of SOUNDS[id]) tone(audio, master, t, audio.currentTime, pitch);
    },
    setVolume(v) {
      volume = v;
      if (master && ctx) master.gain.setValueAtTime(volumeGain(v), ctx.currentTime);
    },
  };
}
