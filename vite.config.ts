import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  server: {
    port: 8080,
    open: process.env.ELECTRON ? false : true,
    strictPort: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    // Keep Vitest focused on unit tests; Playwright handles e2e under tests/e2e
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**', 'release/**'],
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        'release/',
        '*.config.ts',
        '*.config.js',
        'electron/'
      ]
    }
  }
});
