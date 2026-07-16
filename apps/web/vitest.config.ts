import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  },
  resolve: {
    alias: {
      '@home-folder/shared': resolve(__dirname, '../../packages/shared/src/index.ts')
    }
  }
});
