import { app, BrowserWindow, ipcMain } from 'electron';
import started from 'electron-squirrel-startup';
import path from 'path';
import { fileURLToPath } from 'url';

import { createAppConfig, validateConfig } from './config/app.config';
import { createServices, startAllServices, stopAllServices, ServiceContainer, SessionManager } from './services';
import { APP_CONSTANTS } from '../shared/constants';
import { AuthUtils } from './utils/auth.utils';
import { DataAccessService } from './services/data-access.service';
import { HttpClientService } from './services/http-client.service';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Vite constants injected at build time (with fallbacks for manual build)
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string | undefined;

// Global app state
let loginWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;
let services: ServiceContainer | null = null;
let currentUserData: any = null;
let dataAccessService: DataAccessService | null = null;

// Track registered IPC handlers to avoid duplicates
const registeredHandlers = new Set<string>();

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (started) {
  app.quit();
}

export class TaxiaApp {
  private config = createAppConfig();

  async initialize(): Promise<void> {
    console.log('=== INITIALIZING TAXIA APP ===');

    // Validate configuration
    const validation = validateConfig(this.config);
    if (!validation.isValid) {
      console.error('❌ Configuration validation failed:', validation.errors);
      throw new Error(`Configuration errors: ${validation.errors.join(', ')}`);
    }

    console.log('✅ Configuration validated successfully');

    // Set up app event handlers
    this.setupAppEventHandlers();
  }

  private setupAppEventHandlers(): void {
    app.on('ready', () => {
      console.log('=== ELECTRON APP READY ===');
      try {
        this.checkSessionAndStart();
      } catch (error) {
        console.error('=== ERROR STARTING APP ===', error);
        app.quit();
      }
    });

    app.on('window-all-closed', () => {
      console.log('=== ALL WINDOWS CLOSED ===');
      loginWindow = null;
      mainWindow = null;
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      console.log('=== APP ACTIVATED ===');
      if (BrowserWindow.getAllWindows().length === 0) {
        this.checkSessionAndStart();
      }
    });

    app.on('before-quit', async () => {
      console.log('🧹 Cleaning up services...');
      if (services) {
        await stopAllServices(services);
      }
    });
  }

  private async checkSessionAndStart(): Promise<void> {
    console.log('🔍 Checking app mode and session...');

    try {
      // Step 1: Initialize SettingsService to check app mode
      const { SettingsService } = await import('./services/settings.service');
      const settingsService = new SettingsService();
      await settingsService.start();

      const appMode = settingsService.getAppMode();
      console.log(`🔧 App mode: ${appMode}`);

      // Step 2: Check if this is first run (needs setup wizard)
      if (settingsService.isFirstRun()) {
        // Edge case: Config says uninitialized, but database might have data
        // This happens when config is deleted but database remains
        console.log('🔍 First run detected, checking if database already exists...');

        try {
          const { DatabaseService } = await import('./services/database.service');
          const tempDbService = new DatabaseService();
          await tempDbService.start();

          const users = await tempDbService.getAllUsers();
          const hasUsers = users.length > 0;

          await tempDbService.stop();

          if (hasUsers) {
            // Database already initialized, config just got reset
            console.log('⚠️ Database exists but config uninitialized - auto-fixing config to server mode');

            // Auto-fix: Set to server mode (since database exists locally)
            settingsService.setAppMode('server');

            // Proceed to login
            this.createLoginWindow();
            return;
          }
        } catch (error) {
          console.log('📝 No existing database found, continuing with setup');
        }

        console.log('🆕 True first run - showing setup wizard');
        this.createSetupWindow();
        return;
      }

      // Step 3: Check for existing session
      const sessionManager = new SessionManager();

      if (sessionManager.hasValidSession()) {
        console.log('✅ Valid session found, attempting auto-login...');

        // Initialize database to validate session
        const { DatabaseService } = await import('./services/database.service');
        const tempDbService = new DatabaseService();
        await tempDbService.start();

        // Validate session with database
        const userData = await sessionManager.getValidSession(tempDbService);

        if (userData) {
          console.log('🎉 Auto-login successful:', userData);
          currentUserData = userData;

          // Skip login window and go directly to main app
          this.createMainWindow();
          return;
        } else {
          console.log('❌ Session validation failed, clearing invalid session');
          sessionManager.clearSession();
        }

        await tempDbService.stop();
      } else {
        console.log('📝 No valid session found');
      }
    } catch (error) {
      console.error('❌ Error checking session:', error);
    }

    // If we reach here, no valid session exists - show login window
    console.log('📱 Showing login window...');
    this.createLoginWindow();
  }

  private createSetupWindow(): void {
    console.log('=== CREATING SETUP WINDOW ===');

    const preloadPath = path.join(__dirname, '../../.vite/build/preload/index.cjs');
    console.log('🔧 Preload path:', preloadPath);

    loginWindow = new BrowserWindow({
      width: 800,
      height: 500,
      resizable: false,
      center: true,
      show: false,
      backgroundColor: '#004492',
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 15, y: 13 },
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: preloadPath,
        sandbox: false,
        enableRemoteModule: false,
        webSecurity: false,
      },
    });

    loginWindow.webContents.on('did-finish-load', () => {
      console.log('🔧 SETUP: Page finished loading');
      loginWindow?.show();
      loginWindow?.focus();
    });

    loginWindow.on('closed', () => {
      console.log('=== SETUP WINDOW CLOSED ===');
      loginWindow = null;
      // Don't quit immediately - the setup-complete handler will handle the transition
    });

    // Load setup mode
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      // Development mode - load from Vite dev server
      const devServerUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL + '?mode=setup';
      console.log('=== LOADING SETUP DEV SERVER ===', devServerUrl);
      loginWindow.loadURL(devServerUrl).catch((error) => {
        console.error('=== SETUP DEV SERVER FAILED ===', error);
        loginWindow?.loadURL('data:text/html,<h1 style="color: red;">Setup Server Not Available</h1>');
      });
    } else {
      // Production mode - Electron Forge Vite plugin packages files in build directory
      console.log('=== LOADING SETUP PRODUCTION BUILD ===');
      const indexPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
      console.log('Setup index path:', indexPath);
      loginWindow.loadFile(indexPath, { query: { mode: 'setup' } });
    }

    this.setupLoginIpcHandlers();
    this.setupEarlyAuthHandlers();
    this.setupEarlySettingsHandlers();
  }

  private createLoginWindow(): void {
    console.log('=== CREATING LOGIN WINDOW ===');

    const preloadPath = path.join(__dirname, '../../.vite/build/preload/index.cjs');
    console.log('🔧 Preload path:', preloadPath);

    loginWindow = new BrowserWindow({
      width: 800,
      height: 500,
      resizable: false,
      center: true,
      show: false,
      backgroundColor: '#004492',
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 15, y: 13 },
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: preloadPath,
        sandbox: false,
        enableRemoteModule: false,
        webSecurity: false,
      },
    });

    this.setupLoginWindowEventHandlers();
    this.loadLoginWindowContent();
    this.setupLoginIpcHandlers();
    this.setupEarlyAuthHandlers();
  }

  private setupLoginWindowEventHandlers(): void {
    if (!loginWindow) return;

    loginWindow.webContents.on('did-finish-load', () => {
      console.log('🔧 LOGIN: Page finished loading');
      loginWindow?.show();
      loginWindow?.focus();
    });

    loginWindow.on('closed', () => {
      console.log('=== LOGIN WINDOW CLOSED ===');
      loginWindow = null;
      if (!mainWindow) {
        app.quit();
      }
    });
  }

  private loadLoginWindowContent(): void {
    if (!loginWindow) return;

    console.log('=== LOADING LOGIN CONTENT ===');

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      // Development mode - load from Vite dev server
      const devServerUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL + '?mode=login';
      console.log('=== LOADING LOGIN DEV SERVER ===', devServerUrl);
      loginWindow.loadURL(devServerUrl).catch((error) => {
        console.error('=== LOGIN DEV SERVER FAILED ===', error);
        loginWindow?.loadURL('data:text/html,<h1 style="color: red;">Login Server Not Available</h1>');
      });
    } else {
      // Production mode - Electron Forge Vite plugin packages files in build directory
      console.log('=== LOADING LOGIN PRODUCTION BUILD ===');
      const indexPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
      console.log('Login index path:', indexPath);
      loginWindow.loadFile(indexPath, { query: { mode: 'login' } });
    }
  }

  private setupLoginIpcHandlers(): void {
    // Setup completion handler - only register once
    if (!registeredHandlers.has('setup-complete')) {
      registeredHandlers.add('setup-complete');
      ipcMain.handle('setup-complete', () => {
        console.log('✅ Setup completion signaled - transitioning to login screen');
        if (loginWindow) {
          // Transition: Reload the same window with login mode instead of closing/creating new window
          if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
            const devServerUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL + '?mode=login';
            console.log('=== TRANSITIONING TO LOGIN (DEV) ===', devServerUrl);
            loginWindow.loadURL(devServerUrl);
          } else {
            const indexPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
            console.log('=== TRANSITIONING TO LOGIN (PROD) ===', indexPath);
            loginWindow.loadFile(indexPath, { query: { mode: 'login' } });
          }
        }
      });
    }

    // Login success handler
    ipcMain.once('login-success', (event, userData) => {
      console.log('🔐 Login successful:', userData);
      currentUserData = userData; // Store user data globally

      // Create persistent session automatically
      try {
        if (services?.sessionManager) {
          services.sessionManager.createSession(userData);
          console.log('✅ Session created automatically for user:', userData.email);
        } else {
          // Fallback: create temporary session manager if services not ready
          const tempSessionManager = new SessionManager();
          tempSessionManager.createSession(userData);
          console.log('✅ Temporary session created for user:', userData.email);
        }
      } catch (error) {
        console.error('❌ Failed to create session:', error);
        // Continue with login even if session creation fails
      }

      if (loginWindow) {
        loginWindow.close();
        loginWindow = null;
      }
      this.createMainWindow();
    });

    // Login window controls
    ipcMain.handle('login-window-close', () => {
      loginWindow?.close();
    });
  }

  private setupEarlyAuthHandlers(): void {
    console.log('🔧 Setting up early authentication handlers...');

    // Skip if handlers already registered
    if (registeredHandlers.has('auth:login')) {
      console.log('🔧 Early authentication handlers already exist, skipping setup');
      return;
    }

    // Create minimal database service for authentication
    const initializeAuthDatabase = async () => {
      console.log('🔧 [AUTH-DB] Starting auth database initialization...');
      try {
        console.log('🔧 [AUTH-DB] Step 1: Importing DatabaseService...');
        const { DatabaseService } = await import('./services/database.service');
        console.log('✅ [AUTH-DB] Step 1 complete: DatabaseService imported successfully');

        console.log('🔧 [AUTH-DB] Step 2: Creating DatabaseService instance...');
        const dbService = new DatabaseService();
        console.log('✅ [AUTH-DB] Step 2 complete: DatabaseService instance created');

        console.log('🔧 [AUTH-DB] Step 3: Starting database service (connect + ensureSchema)...');
        await dbService.start();
        console.log('✅ [AUTH-DB] Step 3 complete: Database service started successfully');

        console.log('✅ [AUTH-DB] Auth database initialization completed successfully');
        return dbService;
      } catch (error) {
        console.error('❌ [AUTH-DB] Failed to initialize auth database');
        console.error('❌ [AUTH-DB] Error type:', error?.constructor?.name);
        console.error('❌ [AUTH-DB] Error message:', error instanceof Error ? error.message : String(error));
        console.error('❌ [AUTH-DB] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        console.error('❌ [AUTH-DB] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        return null;
      }
    };

    // Authentication operations
    ipcMain.handle('auth:login', async (event, { email, password }) => {
      let dbService = null;
      try {
        console.log('🔐 Early auth login handler called:', { email });

        dbService = await initializeAuthDatabase();
        if (!dbService) {
          throw new Error('Database service not available');
        }

        const user = await dbService.getUserByEmail(email);
        if (!user) {
          await dbService.stop();
          return { success: false, error: 'User not found' };
        }

        const isValidPassword = await AuthUtils.verifyPassword(password, user.password);
        if (!isValidPassword) {
          await dbService.stop();
          return { success: false, error: 'Invalid password' };
        }

        await dbService.stop();
        console.log('✅ Login successful');
        return {
          success: true,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
          }
        };
      } catch (error) {
        console.error('Login failed:', error);
        if (dbService) {
          await dbService.stop();
        }
        return { success: false, error: error instanceof Error ? error.message : 'Login failed' };
      }
    });

    ipcMain.handle('auth:signup', async (event, { name, email, password }) => {
      let dbService = null;
      try {
        console.log('🔐 Early auth signup handler called:', { name, email });

        dbService = await initializeAuthDatabase();
        if (!dbService) {
          // Return detailed error information for debugging
          const errorDetails = {
            message: 'Database service not available',
            hint: 'The database service failed to initialize. This could be due to:\n' +
                  '1. Prisma query engine not found\n' +
                  '2. Database file permissions issue\n' +
                  '3. SQLite initialization failure',
            technicalInfo: 'Check Console.app logs for [AUTH-DB] and [DB] prefixed messages'
          };
          throw new Error(JSON.stringify(errorDetails));
        }

        // Check if user already exists
        const existingUser = await dbService.getUserByEmail(email);
        if (existingUser) {
          await dbService.stop();
          return { success: false, error: 'User already exists' };
        }

        // Check if this is the first user (should be admin)
        const allUsers = await dbService.getAllUsers();
        const isFirstUser = allUsers.length === 0;

        // Hash password
        const hashedPassword = await AuthUtils.hashPassword(password);

        // Create new user - first user is admin, rest are users
        const newUser = await dbService.createUser({
          name,
          email,
          password: hashedPassword,
          role: isFirstUser ? 'admin' : 'user'
        });

        await dbService.stop();
        console.log('✅ Signup successful');
        return {
          success: true,
          user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role
          }
        };
      } catch (error) {
        console.error('Signup failed:', error);
        if (dbService) {
          await dbService.stop();
        }

        // Try to parse detailed error if available
        let errorMessage = 'Signup failed';
        try {
          const parsedError = JSON.parse(error instanceof Error ? error.message : '{}');
          if (parsedError.message) {
            errorMessage = `${parsedError.message}\n\n${parsedError.hint || ''}\n\n${parsedError.technicalInfo || ''}`;
          }
        } catch {
          errorMessage = error instanceof Error ? error.message : 'Signup failed';
        }

        return { success: false, error: errorMessage };
      }
    });

    // Diagnostic handler to check database setup
    ipcMain.handle('debug:check-database-setup', async () => {
      try {
        const diagnostics: any = {
          timestamp: new Date().toISOString(),
          platform: process.platform,
          arch: process.arch,
          resourcesPath: process.resourcesPath || 'Not available (dev mode)',
          checks: []
        };

        // Check 1: Prisma directory exists
        const fs = await import('fs');
        const path = await import('path');

        if (process.resourcesPath) {
          const prismaPath = path.join(process.resourcesPath, '.prisma', 'client');
          const prismaExists = fs.existsSync(prismaPath);
          diagnostics.checks.push({
            name: 'Prisma directory',
            path: prismaPath,
            exists: prismaExists
          });

          if (prismaExists) {
            // Check for query engine binary
            const queryEngineLib = path.join(prismaPath, 'libquery_engine-darwin-arm64.dylib.node');
            const queryEngineExists = fs.existsSync(queryEngineLib);
            diagnostics.checks.push({
              name: 'Query engine binary',
              path: queryEngineLib,
              exists: queryEngineExists,
              size: queryEngineExists ? fs.statSync(queryEngineLib).size : 0
            });
          }
        }

        // Check 2: Try to import Prisma Client (using the same method as database service)
        // The global Module._resolveFilename patch (applied in TaxiaApp.initialize) handles path redirection
        let PrismaClient; // Declare outside try block so it's accessible in Check 4
        try {
          if (process.resourcesPath) {
            // Packaged app - use createRequire (global patch already applied)
            const { createRequire } = await import('module');
            const prismaClientPath = path.join(process.resourcesPath, '.prisma', 'client', 'index.js');
            console.log('[DIAGNOSTIC] Prisma client path:', prismaClientPath);

            const requireFromHere = createRequire(import.meta.url);
            const prismaModule = requireFromHere(prismaClientPath);
            PrismaClient = prismaModule.PrismaClient;
            console.log('[DIAGNOSTIC] PrismaClient loaded, type:', typeof PrismaClient);
          } else {
            // Dev mode - use import
            const prismaModule = await import('@prisma/client');
            PrismaClient = prismaModule.PrismaClient;
          }

          diagnostics.checks.push({
            name: 'Prisma Client import',
            success: true,
            message: `Successfully imported PrismaClient (type: ${typeof PrismaClient})`,
            prismaClientDefined: PrismaClient !== undefined
          });
        } catch (error) {
          console.error('[DIAGNOSTIC] Error during Prisma import:', error);
          console.error('[DIAGNOSTIC] Error stack:', error instanceof Error ? error.stack : 'No stack');
          diagnostics.checks.push({
            name: 'Prisma Client import',
            success: false,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          });
        }

        // Check 3: Database file location
        const { app } = await import('electron');
        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'taxia.db');
        diagnostics.checks.push({
          name: 'Database file location',
          path: dbPath,
          exists: fs.existsSync(dbPath)
        });

        // Check 4: ACTUAL database connection test
        if (PrismaClient) {
          try {
            console.log('🔧 [DIAGNOSTIC] Creating Prisma Client instance for test...');
            const dbUrl = `file:${dbPath}`;
            const testPrisma = new PrismaClient({
              datasources: { db: { url: dbUrl } }
            });

            console.log('🔧 [DIAGNOSTIC] Connecting to database...');
            await testPrisma.$connect();

            console.log('🔧 [DIAGNOSTIC] Running test query...');
            await testPrisma.$queryRaw`SELECT 1`;

            console.log('🔧 [DIAGNOSTIC] Disconnecting...');
            await testPrisma.$disconnect();

            diagnostics.checks.push({
              name: 'Database connection test',
              success: true,
              message: 'Successfully connected and queried database'
            });
          } catch (dbError) {
            console.error('❌ [DIAGNOSTIC] Database connection test failed:', dbError);
            diagnostics.checks.push({
              name: 'Database connection test',
              success: false,
              error: dbError instanceof Error ? dbError.message : String(dbError),
              stack: dbError instanceof Error ? dbError.stack : undefined
            });
          }
        }

        // Check 5: Environment variables
        diagnostics.env = {
          PRISMA_QUERY_ENGINE_LIBRARY: process.env.PRISMA_QUERY_ENGINE_LIBRARY || 'Not set',
          NODE_PATH: process.env.NODE_PATH || 'Not set',
          NODE_ENV: process.env.NODE_ENV || 'Not set'
        };

        return { success: true, diagnostics };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : 'No stack trace'
        };
      }
    });

    // Mark handlers as registered
    registeredHandlers.add('auth:login');
    registeredHandlers.add('auth:signup');

    console.log('✅ Early authentication handlers set up successfully');
  }

  private setupEarlySettingsHandlers(): void {
    console.log('🔧 Setting up early settings handlers...');

    // Create settings service for electron-store (config) settings
    const initializeSettingsService = async () => {
      try {
        console.log('🔧 Initializing SettingsService...');
        const { SettingsService } = await import('./services/settings.service');
        const settingsService = new SettingsService();
        await settingsService.start();
        console.log('✅ SettingsService started successfully');
        return settingsService;
      } catch (error) {
        console.error('❌ Failed to initialize SettingsService:', error);
        return null;
      }
    };

    // Create minimal database service for settings
    const initializeSettingsDatabase = async () => {
      try {
        console.log('🔧 Initializing settings database...');
        const { DatabaseService } = await import('./services/database.service');
        console.log('✅ DatabaseService imported');
        const dbService = new DatabaseService();
        console.log('✅ DatabaseService instance created');
        await dbService.start();
        console.log('✅ DatabaseService started successfully');
        return dbService;
      } catch (error) {
        console.error('❌ Failed to initialize settings database:', error);
        console.error('Error details:', error instanceof Error ? error.message : String(error));
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        return null;
      }
    };

    // Settings operations (needed for setup wizard)
    if (!registeredHandlers.has(APP_CONSTANTS.IPC_CHANNELS.DB_GET_SETTING)) {
      ipcMain.handle(APP_CONSTANTS.IPC_CHANNELS.DB_GET_SETTING, async (event, key) => {
        try {
          console.log('🔧 DB_GET_SETTING handler called for key:', key);
          const dbService = await initializeSettingsDatabase();
          if (!dbService) {
            console.error('❌ Database service not available');
            throw new Error('Database service not available');
          }

          console.log('✅ Database service initialized, getting setting...');
          const value = await dbService.getSetting(key);
          console.log('✅ Got setting value:', value);
          await dbService.stop();
          return value;
        } catch (error) {
          console.error('❌ Failed to get setting:', error);
          console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
          throw error;
        }
      });
      registeredHandlers.add(APP_CONSTANTS.IPC_CHANNELS.DB_GET_SETTING);
    }

    if (!registeredHandlers.has(APP_CONSTANTS.IPC_CHANNELS.DB_SET_SETTING)) {
      ipcMain.handle(APP_CONSTANTS.IPC_CHANNELS.DB_SET_SETTING, async (event, key, value) => {
        try {
          console.log('🔧 DB_SET_SETTING handler called for:', key, '=', value);
          const dbService = await initializeSettingsDatabase();
          if (!dbService) {
            console.error('❌ Database service not available');
            throw new Error('Database service not available');
          }

          console.log('✅ Database service initialized, setting value...');
          await dbService.setSetting(key, value);
          console.log('✅ Setting saved successfully');
          await dbService.stop();
        } catch (error) {
          console.error('❌ Failed to set setting:', error);
          console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
          throw error;
        }
      });
      registeredHandlers.add(APP_CONSTANTS.IPC_CHANNELS.DB_SET_SETTING);
    }

    if (!registeredHandlers.has(APP_CONSTANTS.IPC_CHANNELS.DB_GET_ALL_SETTINGS)) {
      ipcMain.handle(APP_CONSTANTS.IPC_CHANNELS.DB_GET_ALL_SETTINGS, async () => {
        try {
          const dbService = await initializeSettingsDatabase();
          if (!dbService) {
            throw new Error('Database service not available');
          }

          const settings = await dbService.getAllSettings();
          await dbService.stop();
          return settings;
        } catch (error) {
          console.error('Failed to get all settings:', error);
          return {};
        }
      });
      registeredHandlers.add(APP_CONSTANTS.IPC_CHANNELS.DB_GET_ALL_SETTINGS);
    }

    // Electron-store (config) settings operations (for setup wizard)
    if (!registeredHandlers.has('config:set-company-name')) {
      ipcMain.handle('config:set-company-name', async (event, name) => {
        try {
          console.log('🔧 config:set-company-name handler called:', name);
          const settingsService = await initializeSettingsService();
          if (!settingsService) {
            console.error('❌ SettingsService not available');
            throw new Error('SettingsService not available');
          }

          console.log('✅ SettingsService initialized, setting company name...');
          settingsService.setCompanyName(name);
          console.log('✅ Company name saved successfully');
          await settingsService.stop();
        } catch (error) {
          console.error('❌ Failed to set company name:', error);
          throw error;
        }
      });
      registeredHandlers.add('config:set-company-name');
    }

    console.log('✅ Early settings handlers set up successfully');
  }

  private createMainWindow(): void {
    console.log('=== CREATING BROWSER WINDOW ===');

    const preloadPath = path.join(__dirname, '../../.vite/build/preload/index.cjs');
    console.log('🔧 Preload path:', preloadPath);

    mainWindow = new BrowserWindow({
      width: this.config.window.width,
      height: this.config.window.height,
      minWidth: this.config.window.minWidth,
      minHeight: this.config.window.minHeight,
      show: true,
      backgroundColor: this.config.window.backgroundColor,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 15, y: 13 },
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: preloadPath,
        sandbox: false,
        enableRemoteModule: false,
        webSecurity: false, // Temporarily disable for debugging
      },
    });

    this.setupWindowEventHandlers();
    this.loadWindowContent();
    this.setupIpcHandlers();

    // Initialize services after window is created
    this.initializeServices();
  }

  private setupWindowEventHandlers(): void {
    if (!mainWindow) return;

    mainWindow.webContents.on('preload-error', (event, preloadPath, error) => {
      console.error('🔧 PRELOAD ERROR:', preloadPath, error);
    });

    mainWindow.webContents.on('did-finish-load', () => {
      console.log('🔧 RENDERER: Page finished loading');
      this.checkElectronAPIAvailability();
    });

    mainWindow.once('ready-to-show', () => {
      console.log('=== SHOWING WINDOW ===');
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.moveTop();
        mainWindow.setAlwaysOnTop(true);
        setTimeout(() => {
          if (mainWindow) {
            mainWindow.setAlwaysOnTop(false);
          }
        }, APP_CONSTANTS.TIMING.ALWAYS_ON_TOP_DURATION_MS);
      }
    });

    // Fallback - force show after delay
    setTimeout(() => {
      console.log('=== FALLBACK SHOW ===');
      if (mainWindow && !mainWindow.isVisible()) {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.moveTop();
      }
    }, APP_CONSTANTS.TIMING.FALLBACK_SHOW_DELAY_MS);
  }

  private loadWindowContent(): void {
    if (!mainWindow) return;

    console.log('=== LOADING CONTENT ===');

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      // Development mode - load from Vite dev server
      const devServerUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL;
      console.log('=== LOADING DEV SERVER ===', devServerUrl);
      mainWindow.loadURL(devServerUrl).catch((error) => {
        console.error('=== DEV SERVER FAILED ===', error);
        mainWindow?.loadURL('data:text/html,<h1 style="color: red; font-size: 48px;">🚫 Dev Server Not Available</h1><p>Please run the dev server first.</p>');
      });
    } else {
      // Production mode - Electron Forge Vite plugin packages files in build directory
      console.log('=== LOADING PRODUCTION BUILD ===');
      const indexPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
      console.log('Main window index path:', indexPath);
      mainWindow.loadFile(indexPath);
    }
  }

  private checkElectronAPIAvailability(): void {
    if (!mainWindow) return;

    mainWindow.webContents.executeJavaScript(`
      console.log('🔧 RENDERER: Checking electronAPI availability');
      console.log('🔧 RENDERER: window.electronAPI:', typeof window.electronAPI);
      typeof window.electronAPI;
    `).then(result => {
      console.log('🔧 RENDERER: electronAPI type:', result);
    }).catch(error => {
      console.error('🔧 RENDERER: executeJavaScript error:', error);
    });
  }

  private setupIpcHandlers(): void {
    // Window controls
    ipcMain.handle(APP_CONSTANTS.IPC_CHANNELS.WINDOW_CLOSE, () => {
      mainWindow?.close();
    });

    ipcMain.handle(APP_CONSTANTS.IPC_CHANNELS.WINDOW_MINIMIZE, () => {
      mainWindow?.minimize();
    });

    ipcMain.handle(APP_CONSTANTS.IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
      if (mainWindow) {
        if (mainWindow.isMaximized()) {
          mainWindow.unmaximize();
        } else {
          mainWindow.maximize();
        }
      }
    });

    // Local folder watching
    ipcMain.handle('folder-watcher:select-folder', async () => {
      try {
        console.log('📁 folder-watcher:select-folder handler called');
        if (!mainWindow) {
          console.error('❌ mainWindow is null');
          return { success: false, error: 'Main window not available' };
        }

        const { dialog } = await import('electron');
        console.log('📁 Opening folder dialog...');
        const result = await dialog.showOpenDialog(mainWindow, {
          properties: ['openDirectory'],
          title: '통화 녹음 폴더 선택'
        });

        console.log('📁 Dialog result:', result);

        if (result.canceled || result.filePaths.length === 0) {
          console.log('📁 Folder selection cancelled');
          return { success: false, cancelled: true };
        }

        console.log('✅ Folder selected:', result.filePaths[0]);
        return { success: true, folderPath: result.filePaths[0] };
      } catch (error) {
        console.error('❌ Failed to select folder:', error);
        console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
        return { success: false, error: error instanceof Error ? error.message : 'Failed to select folder' };
      }
    });

    ipcMain.handle('folder-watcher:start', async (event, folderPath: string) => {
      try {
        if (!services?.localFolderWatcher) {
          throw new Error('Local folder watcher service not available');
        }

        await services.localFolderWatcher.start(folderPath);
        console.log('✅ Folder watching started:', folderPath);
        return { success: true };
      } catch (error) {
        console.error('❌ Failed to start folder watching:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to start watching' };
      }
    });

    ipcMain.handle('folder-watcher:stop', async () => {
      try {
        if (!services?.localFolderWatcher) {
          throw new Error('Local folder watcher service not available');
        }

        await services.localFolderWatcher.stop();
        console.log('✅ Folder watching stopped');
        return { success: true };
      } catch (error) {
        console.error('❌ Failed to stop folder watching:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to stop watching' };
      }
    });

    ipcMain.handle('folder-watcher:get-status', async () => {
      try {
        if (!services?.localFolderWatcher) {
          return { isWatching: false, watchedFolder: null };
        }

        const isWatching = services.localFolderWatcher.isWatching();
        const watchedFolder = services.localFolderWatcher.getWatchedFolder();

        return { isWatching, watchedFolder };
      } catch (error) {
        console.error('Failed to get folder watcher status:', error);
        return { isWatching: false, watchedFolder: null };
      }
    });

    // Database operations
    ipcMain.handle(APP_CONSTANTS.IPC_CHANNELS.DB_GET_CLIENTS, async () => {
      try {
        return dataAccessService?.getAllClients() || [];
      } catch (error) {
        console.error('Failed to get clients:', error);
        return [];
      }
    });

    ipcMain.handle(APP_CONSTANTS.IPC_CHANNELS.DB_GET_CALLS, async () => {
      try {
        return dataAccessService?.getAllCalls() || [];
      } catch (error) {
        console.error('Failed to get calls:', error);
        return [];
      }
    });

    ipcMain.handle(APP_CONSTANTS.IPC_CHANNELS.DB_GET_TASKS, async () => {
      console.log('🔧 IPC: DB_GET_TASKS handler called');
      try {
        const result = await dataAccessService?.getAllTasks() || [];
        console.log('🔧 IPC: DB_GET_TASKS result:', result);
        return result;
      } catch (error) {
        console.error('Failed to get tasks:', error);
        return [];
      }
    });

    ipcMain.handle(APP_CONSTANTS.IPC_CHANNELS.DB_CREATE_CLIENT, async (event, clientData) => {
      try {
        return dataAccessService?.createClient(clientData);
      } catch (error) {
        console.error('Failed to create client:', error);
        throw error;
      }
    });

    ipcMain.handle(APP_CONSTANTS.IPC_CHANNELS.DB_UPDATE_CLIENT, async (event, clientId, clientData) => {
      try {
        return dataAccessService?.updateClient(clientId, clientData);
      } catch (error) {
        console.error('Failed to update client:', error);
        throw error;
      }
    });

    ipcMain.handle(APP_CONSTANTS.IPC_CHANNELS.DB_CREATE_CALL, async (event, callData) => {
      try {
        return dataAccessService?.createCall(callData);
      } catch (error) {
        console.error('Failed to create call:', error);
        throw error;
      }
    });

    ipcMain.handle(APP_CONSTANTS.IPC_CHANNELS.DB_CREATE_TASK, async (event, taskData) => {
      try {
        return dataAccessService?.createTask(taskData);
      } catch (error) {
        console.error('Failed to create task:', error);
        throw error;
      }
    });

    ipcMain.handle(APP_CONSTANTS.IPC_CHANNELS.DB_UPDATE_TASK, async (event, taskId, taskData) => {
      try {
        return dataAccessService?.updateTask(taskId, taskData);
      } catch (error) {
        console.error('Failed to update task:', error);
        throw error;
      }
    });

    ipcMain.handle(APP_CONSTANTS.IPC_CHANNELS.DB_DELETE_CLIENT, async (event, clientId) => {
      try {
        return dataAccessService?.deleteClient(clientId);
      } catch (error) {
        console.error('Failed to delete client:', error);
        throw error;
      }
    });

    ipcMain.handle(APP_CONSTANTS.IPC_CHANNELS.DB_DELETE_TASK, async (event, taskId) => {
      try {
        return dataAccessService?.deleteTask(taskId);
      } catch (error) {
        console.error('Failed to delete task:', error);
        throw error;
      }
    });

    ipcMain.handle(APP_CONSTANTS.IPC_CHANNELS.DB_DELETE_SUBTASK, async (event, subtaskId) => {
      try {
        return dataAccessService?.deleteSubtask(subtaskId);
      } catch (error) {
        console.error('Failed to delete subtask:', error);
        throw error;
      }
    });

    // Settings operations
    // Check if settings handlers are already set up (early handlers)
    if (!registeredHandlers.has(APP_CONSTANTS.IPC_CHANNELS.DB_GET_SETTING)) {
      ipcMain.handle(APP_CONSTANTS.IPC_CHANNELS.DB_GET_SETTING, async (event, key) => {
        try {
          return dataAccessService?.getSetting(key);
        } catch (error) {
          console.error('Failed to get setting:', error);
          throw error;
        }
      });
      registeredHandlers.add(APP_CONSTANTS.IPC_CHANNELS.DB_GET_SETTING);
    }

    if (!registeredHandlers.has(APP_CONSTANTS.IPC_CHANNELS.DB_SET_SETTING)) {
      ipcMain.handle(APP_CONSTANTS.IPC_CHANNELS.DB_SET_SETTING, async (event, key, value) => {
        try {
          return dataAccessService?.setSetting(key, value);
        } catch (error) {
          console.error('Failed to set setting:', error);
          throw error;
        }
      });
      registeredHandlers.add(APP_CONSTANTS.IPC_CHANNELS.DB_SET_SETTING);
    }

    if (!registeredHandlers.has(APP_CONSTANTS.IPC_CHANNELS.DB_GET_ALL_SETTINGS)) {
      ipcMain.handle(APP_CONSTANTS.IPC_CHANNELS.DB_GET_ALL_SETTINGS, async () => {
        try {
          return dataAccessService?.getAllSettings();
        } catch (error) {
          console.error('Failed to get all settings:', error);
          throw error;
        }
      });
      registeredHandlers.add(APP_CONSTANTS.IPC_CHANNELS.DB_GET_ALL_SETTINGS);
    }

    // User operations
    ipcMain.handle('db:get-users', async () => {
      try {
        return dataAccessService?.getAllUsers() || [];
      } catch (error) {
        console.error('Failed to get users:', error);
        return [];
      }
    });
    ipcMain.handle('db:get-human-users', async () => {
      try {
        // Note: getAllHumanUsers is not in DataAccessService yet - needs to be added
        return services?.databaseService.getAllHumanUsers() || [];
      } catch (error) {
        console.error('Failed to get human users:', error);
        return [];
      }
    });
    ipcMain.handle('db:create-user', async (event, userData) => {
      try {
        return dataAccessService?.createUser(userData);
      } catch (error) {
        console.error('Failed to create user:', error);
        throw error;
      }
    });
    ipcMain.handle('db:get-user-by-role', async (event, role) => {
      try {
        // Note: getUserByRole is not in DataAccessService yet - needs to be added
        return services?.databaseService.getUserByRole(role);
      } catch (error) {
        console.error('Failed to get user by role:', error);
        return null;
      }
    });
    ipcMain.handle(APP_CONSTANTS.IPC_CHANNELS.DB_UPDATE_USER, async (event, userId, userData) => {
      try {
        return dataAccessService?.updateUser(userId, userData);
      } catch (error) {
        console.error('Failed to update user:', error);
        throw error;
      }
    });

    // Subtask operations
    ipcMain.handle('db:get-subtasks-by-task', async (event, taskId) => {
      try {
        return dataAccessService?.getSubtasksByTaskId(taskId) || [];
      } catch (error) {
        console.error('Failed to get subtasks:', error);
        return [];
      }
    });
    ipcMain.handle('db:create-subtask', async (event, subtaskData) => {
      try {
        return dataAccessService?.createSubtask(subtaskData);
      } catch (error) {
        console.error('Failed to create subtask:', error);
        throw error;
      }
    });

    ipcMain.handle(APP_CONSTANTS.IPC_CHANNELS.DB_UPDATE_SUBTASK, async (event, subtaskId, subtaskData) => {
      try {
        return dataAccessService?.updateSubtask(subtaskId, subtaskData);
      } catch (error) {
        console.error('Failed to update subtask:', error);
        throw error;
      }
    });

    // Message operations
    ipcMain.handle('db:get-messages-by-context', async (event, context) => {
      try {
        return dataAccessService?.getMessagesByContext(context) || [];
      } catch (error) {
        console.error('Failed to get messages:', error);
        return [];
      }
    });
    ipcMain.handle('db:create-message', async (event, messageData) => {
      try {
        return dataAccessService?.createMessage(messageData);
      } catch (error) {
        console.error('Failed to create message:', error);
        throw error;
      }
    });

    // File path operations
    ipcMain.handle('app:get-default-download-path', async () => {
      try {
        return path.join(app.getPath('userData'), 'call-recordings');
      } catch (error) {
        console.error('Failed to get default download path:', error);
        return '';
      }
    });

    // User data operations
    ipcMain.handle('app:get-current-user', async () => {
      try {
        console.log('🔧 MAIN: Returning current user data:', currentUserData);
        return currentUserData;
      } catch (error) {
        console.error('Failed to get current user data:', error);
        return null;
      }
    });

    // Session operations for debugging
    ipcMain.handle('app:get-session-info', async () => {
      try {
        if (services?.sessionManager) {
          return services.sessionManager.getSessionInfo();
        } else {
          const tempSessionManager = new SessionManager();
          return tempSessionManager.getSessionInfo();
        }
      } catch (error) {
        console.error('Failed to get session info:', error);
        return { exists: false, error: error.message };
      }
    });

    // Audio file path operations
    ipcMain.handle('app:get-audio-file-path', async (event, fileName) => {
      try {
        console.log('🎵 MAIN: Searching for audio file:', fileName);

        const path = await import('path');
        const fs = await import('fs');

        // Check if file exists in the watched folder (taxia-sync)
        if (services?.localFolderWatcher) {
          const watchedFolder = services.localFolderWatcher.getWatchedFolder();
          if (watchedFolder) {
            const watchedFilePath = path.join(watchedFolder, fileName);
            console.log('🎵 MAIN: Checking watched folder:', watchedFolder);
            console.log('🎵 MAIN: Full file path:', watchedFilePath);

            if (fs.existsSync(watchedFilePath)) {
              console.log('✅ MAIN: Audio file found in watched folder:', watchedFilePath);
              return watchedFilePath;
            } else {
              console.log('⚠️ MAIN: File not found in watched folder');
            }
          } else {
            console.log('⚠️ MAIN: No folder is being watched');
          }
        } else {
          console.log('⚠️ MAIN: Local folder watcher service not available');
        }

        console.warn('❌ MAIN: Audio file not found:', fileName);
        console.warn('❌ MAIN: Please ensure the file exists in the watched folder');

        return null;
      } catch (error) {
        console.error('❌ MAIN: Failed to get audio file path:', error);
        return null;
      }
    });

    ipcMain.handle('app:set-download-path', async (event, downloadPath) => {
      try {
        // TODO: Store the custom download path in settings/config
        // For now, just log the new path
        console.log('Setting download path to:', downloadPath);
        return true;
      } catch (error) {
        console.error('Failed to set download path:', error);
        return false;
      }
    });

    ipcMain.handle('app:select-folder', async () => {
      try {
        const { dialog } = await import('electron');
        const result = await dialog.showOpenDialog(mainWindow!, {
          properties: ['openDirectory'],
          title: '통화 녹음 저장 폴더 선택'
        });

        if (result.canceled || result.filePaths.length === 0) {
          return null;
        }

        return result.filePaths[0];
      } catch (error) {
        console.error('Failed to select folder:', error);
        return null;
      }
    });

    // Get server local URL (for server mode)
    ipcMain.handle('app:get-local-url', async () => {
      try {
        if (services?.webhookService) {
          const localUrl = services.webhookService.getLocalUrl();
          console.log('🌐 MAIN: Returning local URL:', localUrl);
          return localUrl;
        }
        return null;
      } catch (error) {
        console.error('Failed to get local URL:', error);
        return null;
      }
    });

    // Factory reset
    ipcMain.handle('app:factory-reset', async () => {
      try {
        console.log('🔧 Factory reset requested');

        // Show confirmation dialog
        const { dialog } = await import('electron');
        const result = await dialog.showMessageBox(mainWindow!, {
          type: 'warning',
          title: '초기화 확인',
          message: '모든 데이터를 삭제하고 앱을 초기화하시겠습니까?',
          detail: '이 작업은 되돌릴 수 없습니다. 모든 고객, 통화, 업무, 사용자 데이터가 영구적으로 삭제됩니다.',
          buttons: ['취소', '초기화'],
          defaultId: 0,
          cancelId: 0
        });

        if (result.response !== 1) {
          console.log('Factory reset cancelled by user');
          return { success: false, cancelled: true };
        }

        console.log('🗑️  Starting factory reset process...');

        // Step 1: Delete all database data
        console.log('🗑️  Step 1: Deleting database data...');
        if (services?.databaseService) {
          await services.databaseService.deleteAllData();
          console.log('✅ Database data deleted');
        }

        // Step 2: Clear session data
        console.log('🗑️  Step 2: Clearing session data...');
        if (services?.sessionManager) {
          services.sessionManager.clearSession();
          console.log('✅ Session cleared via services');
        } else {
          const tempSessionManager = new SessionManager();
          tempSessionManager.clearSession();
          console.log('✅ Session cleared via temporary manager');
        }

        // Also manually delete the session file to be thorough
        try {
          const fs = await import('fs');
          const sessionPath = path.join(app.getPath('userData'), 'taxia-session.json');
          if (fs.existsSync(sessionPath)) {
            fs.unlinkSync(sessionPath);
            console.log('✅ Session file deleted:', sessionPath);
          }
        } catch (sessionError) {
          console.warn('⚠️  Could not delete session file:', sessionError);
        }

        // Step 3: Reset electron-store config
        console.log('🗑️  Step 3: Resetting app configuration...');
        const { SettingsService } = await import('./services/settings.service');
        const settingsService = new SettingsService();
        await settingsService.start();
        settingsService.clear();
        await settingsService.stop();
        console.log('✅ App configuration reset');

        console.log('🎉 Factory reset completed successfully');
        console.log('🔄 Relaunching app to setup wizard...');

        // Relaunch app (will show setup wizard since config is cleared)
        app.relaunch();
        app.quit();

        return { success: true };
      } catch (error) {
        console.error('❌ Factory reset failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Factory reset failed'
        };
      }
    });
  }

  private setupAuthHandlers(): void {
    console.log('🔧 Setting up authentication handlers...');

    // Check if auth handlers are already set up (early handlers)
    if (registeredHandlers.has('auth:login')) {
      console.log('🔧 Authentication handlers already exist, skipping setup');
      return;
    }

    // Authentication operations
    ipcMain.handle('auth:login', async (event, { email, password }) => {
      try {
        console.log('🔐 Auth login handler called:', { email });

        if (!services?.databaseService) {
          throw new Error('Database service not available');
        }

        if (!AuthUtils.validateEmail(email)) {
          throw new Error('Invalid email format');
        }

        // Get user by email
        const user = await services.databaseService.getUserByEmail(email);
        if (!user) {
          throw new Error('Invalid credentials');
        }

        // Verify password
        const isValidPassword = await AuthUtils.verifyPassword(password, user.password);
        if (!isValidPassword) {
          throw new Error('Invalid credentials');
        }

        // Return user without password
        const { password: _, ...userWithoutPassword } = user;
        console.log('✅ Login successful for:', email);
        return { success: true, user: userWithoutPassword };
      } catch (error) {
        console.error('Login failed:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Login failed' };
      }
    });

    ipcMain.handle('auth:signup', async (event, { name, email, password }) => {
      try {
        console.log('🔐 Auth signup handler called:', { name, email });

        if (!services?.databaseService) {
          throw new Error('Database service not available');
        }

        // Validate input
        if (!name.trim()) {
          throw new Error('Name is required');
        }

        if (!AuthUtils.validateEmail(email)) {
          throw new Error('Invalid email format');
        }

        const passwordValidation = AuthUtils.validatePassword(password);
        if (!passwordValidation.isValid) {
          throw new Error(passwordValidation.errors.join(', '));
        }

        // Check if user already exists
        const existingUser = await services.databaseService.getUserByEmail(email);
        if (existingUser) {
          throw new Error('User already exists with this email');
        }

        // Hash password and create user
        const hashedPassword = await AuthUtils.hashPassword(password);
        const newUser = await services.databaseService.createUser({
          name,
          email,
          password: hashedPassword,
          role: 'user'
        });

        // Return user without password
        const { password: _, ...userWithoutPassword } = newUser;
        console.log('✅ Signup successful for:', email);
        return { success: true, user: userWithoutPassword };
      } catch (error) {
        console.error('Signup failed:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Signup failed' };
      }
    });

    ipcMain.handle('logout', async () => {
      try {
        console.log('🔐 Logout handler called');

        // Clear session first
        try {
          if (services?.sessionManager) {
            services.sessionManager.clearSession();
            console.log('✅ Session cleared via services');
          } else {
            // Fallback: create temporary session manager if services not ready
            const tempSessionManager = new SessionManager();
            tempSessionManager.clearSession();
            console.log('✅ Session cleared via temporary manager');
          }
        } catch (sessionError) {
          console.error('❌ Failed to clear session:', sessionError);
          // Continue with logout even if session clearing fails
        }

        // Clear current user data
        currentUserData = null;
        console.log('✅ Current user data cleared');

        // Reset window to login window size and properties
        if (mainWindow) {
          // Reset size to login dimensions
          mainWindow.setSize(440, 560);

          // Reset window properties to match login window
          mainWindow.setResizable(false);
          mainWindow.setMinimumSize(440, 560);

          // Center the window
          mainWindow.center();
        }

        console.log('✅ Logout completed - session cleared and window reset to login state');
      } catch (error) {
        console.error('Logout failed:', error);
      }
    });

    ipcMain.handle('restore-main-window', async () => {
      try {
        console.log('🔐 Restore main window handler called');

        // Restore window to main app size and properties
        if (mainWindow) {
          // Restore size to main window dimensions
          mainWindow.setSize(this.config.window.width, this.config.window.height);

          // Restore window properties to match main window
          mainWindow.setResizable(true);
          mainWindow.setMinimumSize(this.config.window.minWidth, this.config.window.minHeight);

          // Center the window
          mainWindow.center();
        }

        console.log('✅ Main window restored to full size');
      } catch (error) {
        console.error('Restore main window failed:', error);
      }
    });

    console.log('✅ Authentication handlers registered');
  }


  private async initializeServices(): Promise<void> {
    if (!mainWindow) {
      console.error('❌ Cannot initialize services: mainWindow is null');
      return;
    }

    try {
      console.log('🔧 Initializing services...');

      services = createServices(mainWindow, this.config);

      // Initialize Data Access Service early (before starting services)
      console.log('🔧 Initializing Data Access Service...');
      dataAccessService = new DataAccessService();

      // Configure based on app mode
      const { SettingsService } = await import('./services/settings.service');
      const settingsService = new SettingsService();
      await settingsService.start();

      const appMode = settingsService.getAppMode();

      if (appMode === 'server') {
        // Server mode: use local database
        dataAccessService.setDatabaseService(services.databaseService);
        dataAccessService.setMode(true);
        console.log('✅ Data Access Service configured for SERVER mode (local DB)');
      } else if (appMode === 'client') {
        // Client mode: use HTTP client
        const serverUrl = settingsService.getServerUrl() || 'http://localhost:3000';
        const httpClient = new HttpClientService(serverUrl);
        dataAccessService.setHttpClient(httpClient);
        dataAccessService.setMode(false);
        console.log(`✅ Data Access Service configured for CLIENT mode (HTTP to ${serverUrl})`);
      } else {
        // Uninitialized mode: default to server mode for now
        dataAccessService.setDatabaseService(services.databaseService);
        dataAccessService.setMode(true);
        console.log('⚠️  Data Access Service defaulting to SERVER mode (app uninitialized)');
      }

      await settingsService.stop();

      // Start all services (may fail partially but Data Access Service is already configured)
      try {
        await startAllServices(services);
        console.log('✅ All services started successfully');
      } catch (error) {
        console.error('⚠️  Some services failed to start:', error);
        // Continue anyway - Data Access Service is already configured
      }

      // Auto-restore watched folder from saved settings
      try {
        if (services?.localFolderWatcher && services?.databaseService) {
          console.log('🔧 Checking for saved watched folder path...');
          const savedFolderPath = await services.databaseService.getSetting('watchedFolderPath');

          if (savedFolderPath) {
            console.log('📂 Found saved watched folder path:', savedFolderPath);

            // Check if folder still exists
            const fs = await import('fs');
            if (fs.existsSync(savedFolderPath)) {
              console.log('✅ Folder exists, auto-starting folder watcher...');
              await services.localFolderWatcher.start(savedFolderPath);
              console.log('🎉 Folder watcher auto-started successfully');
            } else {
              console.warn('⚠️  Saved folder path no longer exists:', savedFolderPath);
              console.warn('⚠️  User will need to re-select the folder in settings');
            }
          } else {
            console.log('📂 No saved watched folder path found');
          }
        }
      } catch (error) {
        console.error('⚠️  Failed to auto-restore watched folder:', error);
        // Don't block app startup if folder restoration fails
      }

      // Now that services are available, set up auth handlers
      this.setupAuthHandlers();

      console.log('✅ Service initialization complete');
    } catch (error) {
      console.error('❌ Failed to initialize services:', error);
    }
  }
}

// Export singleton instance
export const taxiaApp = new TaxiaApp();