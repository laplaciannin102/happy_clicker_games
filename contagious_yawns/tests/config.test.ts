import { describe, expect, it } from 'vitest';
import { GAME_ID, STORAGE_PREFIX, storageKey } from '../src/config';

describe('config', () => {
  it('localStorage の接頭辞は claude_ で固定', () => {
    expect(STORAGE_PREFIX).toBe('claude_');
  });

  it('storageKey は接頭辞とゲームIDを付ける', () => {
    expect(storageKey('save')).toBe(`claude_${GAME_ID}_save`);
  });
});
