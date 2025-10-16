// Service exports and factory
import { BrowserWindow } from 'electron';
import { AppConfig } from '../../shared/types';
import { ApiService } from './api.service';
import { FileDetectionService } from './fileDetection.service';
import { OpenAIService } from './openai.service';
import { DatabaseService } from './database.service';
import { WebhookHealthMonitorService } from './webhook-health-monitor.service';
import { SessionManager } from './session.service';
import { LocalFolderWatcherService } from './localFolderWatcher.service';
import {
  ServiceFactoryInterface,
  WebhookServiceInterface,
  LocalFolderWatcherInterface,
  FileDetectionHandlerInterface,
  OpenAIServiceInterface,
  DatabaseServiceInterface
} from './interfaces';

// Export all service classes
export { ApiService } from './api.service';
export { FileDetectionService } from './fileDetection.service';
export { OpenAIService } from './openai.service';
export { DatabaseService } from './database.service';
export { WebhookHealthMonitorService } from './webhook-health-monitor.service';
export { SessionManager } from './session.service';
export { LocalFolderWatcherService } from './localFolderWatcher.service';

// Export all interfaces
export * from './interfaces';

// Service container to hold all services
export interface ServiceContainer {
  webhookService: WebhookServiceInterface;
  localFolderWatcher: LocalFolderWatcherInterface;
  fileDetectionService: FileDetectionHandlerInterface;
  openaiService: OpenAIServiceInterface;
  databaseService: DatabaseServiceInterface;
  webhookHealthMonitor: WebhookHealthMonitorService;
  sessionManager: SessionManager;
}

// Service factory implementation
export class ServiceFactory implements ServiceFactoryInterface {
  createWebhookService(mainWindow: BrowserWindow, config: AppConfig): WebhookServiceInterface {
    return new ApiService(mainWindow, config.webhook);
  }

  createLocalFolderWatcher(mainWindow: BrowserWindow): LocalFolderWatcherInterface {
    return new LocalFolderWatcherService(mainWindow);
  }

  createFileDetectionHandler(mainWindow: BrowserWindow): FileDetectionHandlerInterface {
    return new FileDetectionService(mainWindow);
  }

  createOpenAIService(config: AppConfig): OpenAIServiceInterface {
    return new OpenAIService(config.openai.apiKey);
  }
}

// Main service creation function for easy use
export function createServices(mainWindow: BrowserWindow, config: AppConfig): ServiceContainer {
  const factory = new ServiceFactory();

  const webhookService = factory.createWebhookService(mainWindow, config);
  const localFolderWatcher = factory.createLocalFolderWatcher(mainWindow);
  const fileDetectionService = factory.createFileDetectionHandler(mainWindow);
  const openaiService = factory.createOpenAIService(config);
  const databaseService = new DatabaseService();
  const webhookHealthMonitor = new WebhookHealthMonitorService(mainWindow);
  const sessionManager = new SessionManager();

  // Connect services
  localFolderWatcher.setFileDetectionHandler(fileDetectionService);
  localFolderWatcher.setDatabaseService(databaseService); // For file deletion tracking
  fileDetectionService.setOpenAIService(openaiService);
  fileDetectionService.setDatabaseService(databaseService);
  webhookHealthMonitor.setWebhookService(webhookService);
  openaiService.setDatabaseService(databaseService); // Inject database service for API key loading

  return {
    webhookService,
    localFolderWatcher,
    fileDetectionService,
    openaiService,
    databaseService,
    webhookHealthMonitor,
    sessionManager
  };
}

// Utility function to start all services
export async function startAllServices(services: ServiceContainer): Promise<void> {
  console.log('🚀 Starting all services...');

  try {
    await services.databaseService.start();
    console.log('✅ Database service started');

    // Initialize JWT secret from database (must happen after database starts)
    const { initializeJwtSecret } = await import('../utils/auth.utils');
    await initializeJwtSecret(services.databaseService);

    await services.webhookService.start();
    console.log('✅ Webhook service started');

    // Local folder watcher will be started manually from Settings
    console.log('ℹ️  Local folder watcher ready (start via Settings)');

    await services.openaiService.start();
    console.log('✅ OpenAI service started');

    await services.webhookHealthMonitor.start();
    console.log('✅ Webhook health monitor started');

    console.log('🎉 All services started successfully');
  } catch (error) {
    console.error('❌ Failed to start services:', error);
    throw error;
  }
}

// Utility function to stop all services
export async function stopAllServices(services: ServiceContainer): Promise<void> {
  console.log('🛑 Stopping all services...');

  try {
    await services.webhookHealthMonitor.stop();
    console.log('✅ Webhook health monitor stopped');

    await services.openaiService.stop();
    console.log('✅ OpenAI service stopped');

    await services.localFolderWatcher.stop();
    console.log('✅ Local folder watcher stopped');

    await services.webhookService.stop();
    console.log('✅ Webhook service stopped');

    await services.databaseService.stop();
    console.log('✅ Database service stopped');

    console.log('🎉 All services stopped successfully');
  } catch (error) {
    console.error('❌ Error stopping services:', error);
  }
}
