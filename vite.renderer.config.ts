import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  base: './', // Use relative paths for assets - critical for Electron file:// protocol
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    hmr: {
      port: 5174,
    },
  },
  // Let Electron Forge Vite plugin handle the build output directory
});
