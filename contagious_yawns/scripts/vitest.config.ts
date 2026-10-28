import { defineConfig } from 'vitest/config';

// バランスシミュレーター用（npm run simulate）。ふだんのテスト（npm test）には含めない。
export default defineConfig({
  test: {
    include: ['**/*.sim.ts'],
    environment: 'node',
  },
});
