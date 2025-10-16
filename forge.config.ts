import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import * as fs from 'fs';
import * as path from 'path';

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpack: '**/.prisma/**' // Unpack Prisma binaries from ASAR
    },
    icon: './build/icon', // Electron Forge will automatically add .icns for macOS, .ico for Windows
    extraResource: [
      './node_modules/.prisma',
      './node_modules/@prisma' // Include @prisma/client as extra resource
    ],
  },
  hooks: {
    postPackage: async (_forgeConfig, options) => {
      console.log('🔧 Running postPackage hooks...');

      const productName = options.productName || 'Taxia';
      const resourcesPath = path.join(options.outputPaths[0], options.platform === 'darwin'
        ? `${productName}.app/Contents/Resources`
        : 'resources');
      const asarPath = path.join(resourcesPath, 'app.asar');

      // Step 1: Create node_modules/@prisma symlink for Prisma to resolve runtime
      try {
        console.log('🔗 Creating node_modules structure for Prisma...');
        const nodeModulesPath = path.join(resourcesPath, 'node_modules');
        const prismaSymlinkPath = path.join(nodeModulesPath, '@prisma');
        const prismaTargetPath = path.join(resourcesPath, '@prisma');

        // Create node_modules directory if it doesn't exist
        if (!fs.existsSync(nodeModulesPath)) {
          fs.mkdirSync(nodeModulesPath, { recursive: true });
        }

        // Create symlink: node_modules/@prisma -> ../\@prisma
        if (!fs.existsSync(prismaSymlinkPath)) {
          fs.symlinkSync(prismaTargetPath, prismaSymlinkPath, 'dir');
          console.log('✅ Created symlink: node_modules/@prisma -> @prisma');
        }
      } catch (error) {
        console.error('❌ Failed to create Prisma symlink:', error);
      }

      // Step 2: Rename preload file from .js to .cjs
      try {
        console.log('📝 Renaming preload file...');
        const asar = await import('@electron/asar');
        const tempDir = path.join(options.outputPaths[0], 'temp-asar-extract');
        asar.extractAll(asarPath, tempDir);

        const tempPreloadOld = path.join(tempDir, '.vite/build/preload/index.js');
        const tempPreloadNew = path.join(tempDir, '.vite/build/preload/index.cjs');

        if (fs.existsSync(tempPreloadOld)) {
          fs.renameSync(tempPreloadOld, tempPreloadNew);
          console.log('✅ Renamed preload: index.js → index.cjs');

          // Repack asar
          fs.unlinkSync(asarPath);
          await asar.createPackage(tempDir, asarPath);
          console.log('✅ Repacked asar with renamed preload');
        } else {
          console.log('ℹ️  Preload file already has .cjs extension or not found');
        }

        // Always clean up temp directory
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
          console.log('🧹 Cleaned up temp directory');
        }
      } catch (error) {
        console.error('❌ Failed to rename preload:', error);
      }

      console.log('🎉 PostPackage hooks completed');
    },
  },
  rebuildConfig: {},
  makers: [
    // Windows installer
    new MakerSquirrel({}, ['win32']),

    // macOS installer
    new MakerDMG({
      format: 'ULFO', // Compressed format for smaller file size
      icon: './build/icon.icns', // DMG icon
      background: './build/dmg/background.png',
      contents: (opts) => {
        return [
          { x: 180, y: 170, type: 'file', path: opts.appPath },
          { x: 480, y: 170, type: 'link', path: '/Applications' }
        ];
      },
      additionalDMGOptions: {
        window: {
          position: { x: 400, y: 100 },
          size: { width: 660, height: 400 }
        }
      }
    }, ['darwin']),

    // Portable ZIP for both platforms
    new MakerZIP({}, ['darwin', 'win32']),

    // Linux installers (optional - can remove if not needed)
    new MakerDeb({}, ['linux']),
    new MakerRpm({}, ['linux']),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
