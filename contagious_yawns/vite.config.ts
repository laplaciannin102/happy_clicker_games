import { defineConfig } from 'vitest/config';

export default defineConfig({
  // 相対パス：フォルダ名・公開URL上のパスが変わっても壊れないようにする（SPEC §2.1）
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
