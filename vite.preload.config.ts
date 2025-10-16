import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    lib: {
      entry: 'src/preload/index.ts',
      formats: ['cjs'],
      fileName: 'index',
    },
    outDir: '.vite/build/preload',
    rollupOptions: {
      output: {
        entryFileNames: 'index.cjs',
      },
      external: ['electron'],
    },
  },
});
