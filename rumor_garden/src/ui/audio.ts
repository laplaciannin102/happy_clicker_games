import { presentation } from '../data/presentation';
import type { Preferences } from '../state/preferences';
export type Sound = keyof typeof presentation.sounds;

// Local Web Audio synthesis: no network, audio dependency, or autoplay on arrival.
export function createAudio(preferences: () => Preferences) {
  let context: AudioContext | undefined, master: GainNode | undefined, lastSound = -Infinity, unlocked = false;
  function sync() {
    if (context && master) master.gain.setValueAtTime(preferences().sound ? preferences().volume : 0, context.currentTime);
  }
  function unlock() {
    if (!preferences().sound) return;
    try {
      unlocked = true;
      if (!context) { context = new AudioContext(); master = context.createGain(); master.connect(context.destination); }
      sync(); if (context.state === 'suspended') void context.resume().catch(() => undefined);
    } catch { /* Optional audio may be unavailable. */ }
  }
  function play(sound: Sound) {
    const p = preferences();
    if (!unlocked || !p.sound || p.volume === 0 || performance.now() - lastSound < presentation.soundCooldownMs || document.hidden) return;
    try {
      if (!context || !master || context.state !== 'running') return;
      lastSound = performance.now();
      presentation.sounds[sound].forEach((frequency, index) => {
        const oscillator = context!.createOscillator(), gain = context!.createGain();
        const start = context!.currentTime + index * 0.055;
        oscillator.type = sound === 'click' ? 'triangle' : 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start); gain.gain.exponentialRampToValueAtTime(0.12, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
        oscillator.connect(gain); gain.connect(master!); oscillator.start(start); oscillator.stop(start + 0.15);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      });
    } catch { /* Audio remains optional when unsupported or blocked by the browser. */ }
  }
  return { play, unlock, sync };
}
