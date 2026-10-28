import { describe, expect, it } from 'vitest';
import { resolveConfig } from 'vite';

describe('静的配信のビルド設定', () => {
  it('フォルダ名に依存せず、相対パスでアセットを配信する', async () => {
    const config = await resolveConfig({}, 'build');
    expect(config.base).toBe('./');
    expect(config.build.outDir).toBe('dist');
  });
});
