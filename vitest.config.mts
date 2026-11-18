import { fileURLToPath } from 'node:url';
import type { ViteUserConfig } from 'vitest/config';

export default {
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      { find: /^vitest$/, replacement: fileURLToPath(new URL('./scripts/testing/node_modules/vitest/dist/index.js', import.meta.url)) },
    ],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage/vitest',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/lib/**/*.ts', 'src/app/api/**/route.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
      thresholds: {
        lines: 51,
        functions: 52,
        branches: 42,
        statements: 50,
      },
    },
  },
} satisfies ViteUserConfig;
