import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  publicDir: 'static',
  resolve: {
    alias: { $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) },
  },
  build: { outDir: 'build' },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
