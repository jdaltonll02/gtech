import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      thresholds: {
        statements: 33,
        branches: 15,
        functions: 18,
        lines: 53,
      },
    },
  },
});
