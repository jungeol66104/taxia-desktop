import chokidar from 'chokidar';
import path from 'path';
import { BrowserWindow } from 'electron';
import { FileDetectionHandlerInterface, DatabaseServiceInterface } from './interfaces';

export interface LocalFolderWatcherInterface {
  start(folderPath: string): Promise<void>;
  stop(): Promise<void>;
  isWatching(): boolean;
  getWatchedFolder(): string | null;
}

export class LocalFolderWatcherService implements LocalFolderWatcherInterface {
  private watcher: chokidar.FSWatcher | null = null;
  private watchedFolder: string | null = null;
  private fileDetectionHandler: FileDetectionHandlerInterface | null = null;
  private databaseService: DatabaseServiceInterface | null = null;
  private mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  setFileDetectionHandler(handler: FileDetectionHandlerInterface): void {
    this.fileDetectionHandler = handler;
  }

  setDatabaseService(service: DatabaseServiceInterface): void {
    this.databaseService = service;
  }

  async start(folderPath: string): Promise<void> {
    if (this.watcher) {
      await this.stop();
    }

    if (!this.fileDetectionHandler) {
      throw new Error('File detection handler not set');
    }

    console.log('👀 Starting to watch local folder:', folderPath);

    // NEW: Scan existing files in folder BEFORE starting watcher
    console.log('🔍 Scanning for existing audio files in folder...');
    await this.scanExistingFiles(folderPath);
    console.log('✅ Existing files scan completed');

    // Watch for audio files (wav, mp3, m4a, etc.)
    this.watcher = chokidar.watch(folderPath, {
      ignored: /(^|[\/\\])\../, // Ignore dotfiles
      persistent: true,
      ignoreInitial: true, // Don't trigger for existing files (we already scanned them above)
      awaitWriteFinish: {
        stabilityThreshold: 2000, // Wait 2s for file write to finish
        pollInterval: 100
      },
      depth: 0 // Only watch the specified folder, not subdirectories
    });

    // Listen for new files
    this.watcher.on('add', (filePath) => {
      const fileName = path.basename(filePath);

      // Check if it's an audio file
      if (this.isAudioFile(fileName)) {
        console.log('🎵 New audio file detected:', fileName);
        console.log('📁 Full path:', filePath);

        // Trigger file processing
        if (this.fileDetectionHandler) {
          this.fileDetectionHandler.handleFileDetected({
            localFilePath: filePath,
            fileName: fileName,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        console.log('⏭️  Skipping non-audio file:', fileName);
      }
    });

    // NEW: Listen for file deletions
    this.watcher.on('unlink', async (filePath) => {
      const fileName = path.basename(filePath);

      if (this.isAudioFile(fileName) && this.databaseService) {
        console.log('🗑️  Audio file deleted:', fileName);

        // Find call in database and mark as file missing
        const call = await this.databaseService.getCallByFileName(fileName);
        if (call) {
          await this.databaseService.updateCallFileExists(call.id, false);
          console.log(`✅ Marked call ${call.id} as fileExists=false`);
        }
      }
    });

    this.watcher.on('error', (error) => {
      console.error('❌ Folder watcher error:', error);
    });

    this.watchedFolder = folderPath;
    console.log('✅ Folder watching started');
    console.log('📂 Watching for audio files (wav, mp3, m4a, aac, flac, ogg) in:', folderPath);
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      this.watchedFolder = null;
      console.log('🛑 Folder watching stopped');
    }
  }

  isWatching(): boolean {
    return this.watcher !== null;
  }

  getWatchedFolder(): string | null {
    return this.watchedFolder;
  }

  private isAudioFile(fileName: string): boolean {
    const audioExtensions = ['.wav', '.mp3', '.m4a', '.aac', '.flac', '.ogg'];
    const ext = path.extname(fileName).toLowerCase();
    return audioExtensions.includes(ext);
  }

  /**
   * Scan existing files in folder and process them
   * Called once when starting folder watching
   */
  private async scanExistingFiles(folderPath: string): Promise<void> {
    try {
      console.log(`🔍 [SCAN] Starting scan in: ${folderPath}`);
      const fs = await import('fs').then(m => m.promises);
      const files = await fs.readdir(folderPath);
      console.log(`🔍 [SCAN] Total files found: ${files.length}`);

      const audioFiles = files.filter(f => this.isAudioFile(f));
      console.log(`📋 [SCAN] Found ${audioFiles.length} audio files in folder`);
      console.log(`📋 [SCAN] Audio files:`, audioFiles);

      if (audioFiles.length === 0) {
        console.log(`ℹ️  [SCAN] No audio files to process`);
        return;
      }

      // Process files one by one (avoid overwhelming the system)
      for (let i = 0; i < audioFiles.length; i++) {
        const fileName = audioFiles[i];
        const filePath = path.join(folderPath, fileName);

        console.log(`📥 [SCAN] Processing file ${i + 1}/${audioFiles.length}: ${fileName}`);

        // Trigger file detection handler (which checks for duplicates)
        if (this.fileDetectionHandler) {
          try {
            await this.fileDetectionHandler.handleFileDetected({
              localFilePath: filePath,
              fileName: fileName,
              timestamp: new Date().toISOString()
            });
            console.log(`✅ [SCAN] File processed successfully: ${fileName}`);
          } catch (error) {
            console.error(`❌ [SCAN] Error processing file ${fileName}:`, error);
          }
        } else {
          console.error(`❌ [SCAN] No file detection handler available`);
        }

        // Add small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`✅ [SCAN] Finished processing ${audioFiles.length} existing files`);
    } catch (error) {
      console.error('❌ [SCAN] Failed to scan existing files:', error);
      console.error('❌ [SCAN] Error details:', error instanceof Error ? error.message : String(error));
      console.error('❌ [SCAN] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    }
  }
}
