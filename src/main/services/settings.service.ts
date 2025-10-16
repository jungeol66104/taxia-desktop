import Store from 'electron-store';
import { BaseService } from './interfaces';

/**
 * App mode type definition
 * - 'uninitialized': First time launch, needs setup wizard
 * - 'server': This PC is the server (has DB, API, Google Drive)
 * - 'client': This PC connects to a server
 */
export type AppMode = 'uninitialized' | 'server' | 'client';

/**
 * Local settings stored on each PC
 * These are machine-specific and NOT shared across the network
 */
interface LocalSettings {
  // Mode (both server and client)
  app_mode: AppMode;

  // Server-specific settings
  server_port?: number;
  google_drive_folder_id?: string;
  company_name?: string;

  // Client-specific settings
  server_url?: string;
  last_logged_in_user?: string;

  // UI preferences (both)
  theme?: 'light' | 'dark';
  window_position?: { x: number; y: number };
  window_size?: { width: number; height: number };
}

/**
 * Settings Service
 * Manages local app settings using electron-store
 *
 * Storage location:
 * - macOS: ~/Library/Application Support/taxia/config.json
 * - Windows: %APPDATA%/taxia/config.json
 * - Linux: ~/.config/taxia/config.json
 */
export class SettingsService implements BaseService {
  private store: Store<LocalSettings>;
  private running = false;

  constructor() {
    this.store = new Store<LocalSettings>({
      defaults: {
        app_mode: 'uninitialized'
      }
    });
  }

  async start(): Promise<void> {
    this.running = true;
    console.log('✅ Settings service started');
    console.log(`📁 Config file: ${this.store.path}`);
    console.log(`🔧 Current mode: ${this.getAppMode()}`);
  }

  async stop(): Promise<void> {
    this.running = false;
    console.log('✅ Settings service stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  // ==========================================
  // Generic Methods
  // ==========================================

  /**
   * Get a setting value by key
   */
  get<K extends keyof LocalSettings>(key: K): LocalSettings[K] {
    return this.store.get(key);
  }

  /**
   * Set a setting value by key
   */
  set<K extends keyof LocalSettings>(key: K, value: LocalSettings[K]): void {
    this.store.set(key, value);
    console.log(`💾 Setting saved: ${key} = ${JSON.stringify(value)}`);
  }

  /**
   * Check if a setting exists
   */
  has(key: keyof LocalSettings): boolean {
    return this.store.has(key);
  }

  /**
   * Delete a setting
   */
  delete(key: keyof LocalSettings): void {
    this.store.delete(key);
  }

  /**
   * Clear all settings (reset to defaults)
   */
  clear(): void {
    this.store.clear();
    console.log('🗑️  All settings cleared');
  }

  // ==========================================
  // App Mode Methods
  // ==========================================

  /**
   * Get the current app mode
   */
  getAppMode(): AppMode {
    return this.get('app_mode');
  }

  /**
   * Set the app mode
   */
  setAppMode(mode: AppMode): void {
    this.set('app_mode', mode);
  }

  /**
   * Check if this is the first time the app is running
   */
  isFirstRun(): boolean {
    return this.getAppMode() === 'uninitialized';
  }

  /**
   * Check if this PC is configured as a server
   */
  isServer(): boolean {
    return this.getAppMode() === 'server';
  }

  /**
   * Check if this PC is configured as a client
   */
  isClient(): boolean {
    return this.getAppMode() === 'client';
  }

  // ==========================================
  // Server-Specific Methods
  // ==========================================

  /**
   * Get the server port (default: 3000)
   */
  getServerPort(): number {
    return this.get('server_port') || 3000;
  }

  /**
   * Set the server port
   */
  setServerPort(port: number): void {
    this.set('server_port', port);
  }

  /**
   * Get the Google Drive folder ID
   */
  getGoogleDriveFolderId(): string | undefined {
    return this.get('google_drive_folder_id');
  }

  /**
   * Set the Google Drive folder ID
   */
  setGoogleDriveFolderId(folderId: string): void {
    this.set('google_drive_folder_id', folderId);
  }

  /**
   * Get the company name
   */
  getCompanyName(): string | undefined {
    return this.get('company_name');
  }

  /**
   * Set the company name
   */
  setCompanyName(name: string): void {
    this.set('company_name', name);
  }

  // ==========================================
  // Client-Specific Methods
  // ==========================================

  /**
   * Get the server URL (e.g., "http://192.168.1.100:3000")
   */
  getServerUrl(): string | undefined {
    return this.get('server_url');
  }

  /**
   * Set the server URL
   */
  setServerUrl(url: string): void {
    // Remove trailing slash if present
    const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    this.set('server_url', cleanUrl);
  }

  /**
   * Get the last logged in user email
   */
  getLastLoggedInUser(): string | undefined {
    return this.get('last_logged_in_user');
  }

  /**
   * Set the last logged in user email
   */
  setLastLoggedInUser(email: string): void {
    this.set('last_logged_in_user', email);
  }

  // ==========================================
  // UI Preference Methods
  // ==========================================

  /**
   * Get the theme preference
   */
  getTheme(): 'light' | 'dark' | undefined {
    return this.get('theme');
  }

  /**
   * Set the theme preference
   */
  setTheme(theme: 'light' | 'dark'): void {
    this.set('theme', theme);
  }

  /**
   * Get window position
   */
  getWindowPosition(): { x: number; y: number } | undefined {
    return this.get('window_position');
  }

  /**
   * Set window position
   */
  setWindowPosition(position: { x: number; y: number }): void {
    this.set('window_position', position);
  }

  /**
   * Get window size
   */
  getWindowSize(): { width: number; height: number } | undefined {
    return this.get('window_size');
  }

  /**
   * Set window size
   */
  setWindowSize(size: { width: number; height: number }): void {
    this.set('window_size', size);
  }

  // ==========================================
  // Debug / Development Methods
  // ==========================================

  /**
   * Get all settings (for debugging)
   */
  getAll(): LocalSettings {
    return this.store.store;
  }

  /**
   * Print all settings to console (for debugging)
   */
  debug(): void {
    console.log('=== Settings Debug ===');
    console.log(JSON.stringify(this.getAll(), null, 2));
    console.log('=====================');
  }
}
