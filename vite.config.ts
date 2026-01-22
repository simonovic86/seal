import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Relative paths for IPFS and non-root deployments
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        vault: resolve(__dirname, 'vault.html'),
        restore: resolve(__dirname, 'restore.html'),
      },
    },
    minify: 'terser',
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});

