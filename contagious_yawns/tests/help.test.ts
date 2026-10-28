import { describe, expect, it } from 'vitest';
import { ja } from '../src/i18n/ja';
import { createInitialState } from '../src/state/gameState';
import { helpParams } from '../src/ui/helpPage';

describe('遊び方', () => {
  it('文中の {…} はすべて埋まる（数値は data から入る）', () => {
    const values = helpParams(createInitialState(0, 1));
    for (const section of Object.values(ja.help.sections)) {
      for (const line of section.lines) {
        for (const [, key] of line.matchAll(/\{(\w+)\}/g)) expect(values).toHaveProperty(key ?? '');
      }
    }
  });
});
