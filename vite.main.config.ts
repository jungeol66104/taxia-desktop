import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command, mode }) => {
  // Check if we're in actual production packaging (electron-forge make/package)
  // vs dev build (npm start which also uses 'build' command but for dev server)
  const isPackaging = process.env.npm_lifecycle_event?.includes('package') ||
                      process.env.npm_lifecycle_event?.includes('make');

  console.log('🔧 Vite config:', { command, mode, isPackaging, lifecycle: process.env.npm_lifecycle_event });

  return {
    define: {
      // During 'npm start', we want the dev server URL even though command='build'
      // Only set to undefined when actually packaging the app
      'MAIN_WINDOW_VITE_DEV_SERVER_URL': isPackaging ? 'undefined' : JSON.stringify('http://localhost:5173'),
      'MAIN_WINDOW_VITE_NAME': JSON.stringify('main_window'),
    },
    build: {
      outDir: '.vite/build',
      lib: {
        entry: 'src/main/index.ts',
        formats: ['es'],
        fileName: () => 'index.js',
      },
      rollupOptions: {
        external: [
          // Electron (must be external)
          'electron',

          // Node.js built-in modules (must be external)
          'path',
          'fs',
          'crypto',
          'os',
          'url',
          'events',
          'net',
          'tls',
          'http',
          'https',
          'stream',
          'util',
          'child_process',
          'querystring',
          'zlib',
          'process',
          'async_hooks',
          'http2',
          'assert',
          'buffer',
          'worker_threads',
          'module',

          // Node.js built-in modules with node: prefix
          'node:path',
          'node:fs',
          'node:fs/promises',
          'node:crypto',
          'node:os',
          'node:url',
          'node:events',
          'node:net',
          'node:tls',
          'node:http',
          'node:https',
          'node:stream',
          'node:util',
          'node:child_process',
          'node:querystring',
          'node:zlib',
          'node:process',
          'node:async_hooks',
          'node:http2',
          'node:assert',
          'node:buffer',
          'node:stream/web',

          // Native modules (must be external - handled by AutoUnpackNativesPlugin)
          '@prisma/client',
          '.prisma/client',

          // All other npm packages will be bundled by Vite
          // This includes: electron-store, express, googleapis, localtunnel, openai, chokidar, etc.
        ],
      },
      target: 'node18',
      minify: false,
      emptyOutDir: false,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      // Force Node.js resolution conditions (not browser)
      conditions: ['node'],
    },
  };
});
