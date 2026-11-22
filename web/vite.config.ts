import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {port: 5173},
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx','src/**/*.test.{ts,tsx}','src/test/**','src/**/*.d.ts','src/**/domain/**'],
      reporter: ['text','json-summary'],
      thresholds: {statements: 70,branches: 60,functions: 60,lines: 90},
    },
  },
});
