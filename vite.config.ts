import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
  build: {
    rollupOptions: {
      input: {
        legacy: resolve(import.meta.dirname, 'index.html'),
        'scenario1-p4': resolve(import.meta.dirname, 'scenario1-p4.html'),
      },
    },
  },
});
