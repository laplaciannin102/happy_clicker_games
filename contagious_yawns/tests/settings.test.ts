import { describe, expect, it } from 'vitest';
import { SOUND, SOUNDS, SOUND_IDS } from '../src/data/sounds';
import { decodeSave, encodeSave } from '../src/save/codec';
import { migrate } from '../src/save/migrations';
import { fromPayload, toPayload } from '../src/save/payload';
import { createInitialState, DEFAULT_DISPLAY_SETTINGS } from '../src/state/gameState';
import { imageUrl } from '../src/ui/icons';
import { volumeGain } from '../src/ui/sound';
import { playedState } from './helpers';

/** ペイロードの settings だけを書き換えて読み直す */
function withSettings(patch: Record<string, unknown>): ReturnType<typeof fromPayload> {
  const raw = JSON.parse(JSON.stringify(toPayload(playedState()))) as Record<string, unknown>;
  raw.settings = { ...(raw.settings as Record<string, unknown>), ...patch };
  return fromPayload(raw);
}

describe('表示と音の設定', () => {
  it('はじめは 端末に合わせる・演出あり・音量50%・30秒ごとに自動セーブ', () => {
    const s = createInitialState(0, 1);
    expect(s.settings).toMatchObject({ theme: 'auto', effects: true, volume: 50, autosaveSec: 30 });
  });

  it('セーブの往復で保たれる', async () => {
    const s = playedState();
    const back = await decodeSave(await encodeSave(s), { allowLegacyJson: false });
    expect(back.ok && back.value.state.settings).toEqual(s.settings);
  });

  it('v10 → v11：初期値が足され、ほかの設定は残る', () => {
    expect(migrate({ settings: { notation: 'sci', autoBuy: false } }, 10)).toMatchObject({
      settings: { notation: 'sci', autoBuy: false, ...DEFAULT_DISPLAY_SETTINGS },
    });
  });

  it('おかしな値は読み込まない', () => {
    expect(withSettings({})).not.toBeNull();
    expect(withSettings({ theme: 'neon' })).toBeNull();
    expect(withSettings({ effects: 'yes' })).toBeNull();
    expect(withSettings({ volume: 35 })).toBeNull();
    expect(withSettings({ volume: 110 })).toBeNull();
    expect(withSettings({ volume: -10 })).toBeNull();
    expect(withSettings({ autosaveSec: 5 })).toBeNull();
    expect(withSettings({ volume: 0, autosaveSec: 120, theme: 'light' })).not.toBeNull();
  });
});

describe('効果音', () => {
  it('すべての効果音に音があり、高さ・長さ・大きさが無理のない範囲', () => {
    for (const id of SOUND_IDS) {
      const tones = SOUNDS[id];
      expect(tones.length).toBeGreaterThan(0);
      for (const t of tones) {
        expect(t.freq).toBeGreaterThanOrEqual(60);
        expect(t.freq).toBeLessThanOrEqual(4000);
        if (t.slideTo !== undefined) expect(t.slideTo).toBeGreaterThan(0);
        expect(t.at).toBeGreaterThanOrEqual(0);
        expect(t.dur).toBeGreaterThan(SOUND.attack);
        expect(t.at + t.dur).toBeLessThanOrEqual(3);
        expect(t.gain).toBeGreaterThan(0);
        expect(t.gain).toBeLessThanOrEqual(0.5);
      }
    }
  });

  it('音量 0 は無音、100 で最大、そのあいだは大きくなるほど大きい', () => {
    expect(volumeGain(0)).toBe(0);
    expect(volumeGain(100)).toBeCloseTo(SOUND.masterGain);
    expect(volumeGain(150)).toBeCloseTo(SOUND.masterGain);
    for (let v = 10; v <= 100; v += 10) expect(volumeGain(v)).toBeGreaterThan(volumeGain(v - 10));
  });
});

describe('画像', () => {
  it('置かれていない画像は undefined（絵文字のまま動く）', () => {
    expect(imageUrl('producers', 'no_such_producer')).toBeUndefined();
  });
});
