import { BrowserWindow } from 'electron';
import { WebhookServiceInterface } from './interfaces';
import { APP_CONSTANTS } from '../../shared/constants';

export class WebhookHealthMonitorService {
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private webhookService: WebhookServiceInterface | null = null;
  private mainWindow: BrowserWindow | null = null;
  private running = false;
  private consecutiveFailures = 0;
  private maxConsecutiveFailures = 3;
  private healthCheckIntervalMs = 5 * 60 * 1000; // 5 minutes

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  setWebhookService(service: WebhookServiceInterface): void {
    this.webhookService = service;
  }

  async start(): Promise<void> {
    if (this.running) {
      console.log('⚠️  Webhook health monitor already running');
      return;
    }

    console.log('🔍 Starting webhook health monitoring...');
    this.running = true;
    this.startHealthChecks();
  }

  async stop(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    this.running = false;
    console.log('🛑 Webhook health monitoring stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  private startHealthChecks(): void {
    // Initial health check after 30 seconds
    setTimeout(() => {
      this.performHealthCheck();
    }, 30000);

    // Regular health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.healthCheckIntervalMs);
  }

  private async performHealthCheck(): Promise<void> {
    if (!this.webhookService || !this.running) {
      return;
    }

    try {
      const webhookUrl = this.webhookService.getWebhookUrl();
      if (!webhookUrl) {
        console.log('⚠️  No webhook URL available for health check');
        this.handleHealthCheckFailure('No webhook URL available');
        return;
      }

      console.log('🔍 Performing webhook health check:', webhookUrl);

      // Test if webhook endpoint is reachable externally
      const response = await fetch(webhookUrl, {
        method: 'GET',
        timeout: 10000 // 10 second timeout
      });

      if (response.ok) {
        console.log('✅ Webhook health check passed');
        this.handleHealthCheckSuccess();
      } else {
        console.warn(`⚠️  Webhook health check failed: HTTP ${response.status}`);
        this.handleHealthCheckFailure(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.warn('⚠️  Webhook health check failed:', error);
      this.handleHealthCheckFailure(error.message);
    }
  }

  private handleHealthCheckSuccess(): void {
    if (this.consecutiveFailures > 0) {
      console.log('✅ Webhook health restored after failures');
      this.notifyHealthStatus('healthy', {
        message: 'Webhook connectivity restored',
        consecutiveFailures: this.consecutiveFailures,
        timestamp: new Date().toISOString()
      });
    }
    this.consecutiveFailures = 0;
  }

  private handleHealthCheckFailure(error: string): void {
    this.consecutiveFailures++;

    console.warn(`⚠️  Webhook health check failure ${this.consecutiveFailures}/${this.maxConsecutiveFailures}: ${error}`);

    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      console.error('🚨 Webhook health critical - triggering recovery');

      this.notifyHealthStatus('critical', {
        error,
        consecutiveFailures: this.consecutiveFailures,
        timestamp: new Date().toISOString()
      });

      // Trigger webhook recovery (tunnel reconnection)
      this.triggerWebhookRecovery();
    } else {
      this.notifyHealthStatus('degraded', {
        error,
        consecutiveFailures: this.consecutiveFailures,
        maxFailures: this.maxConsecutiveFailures,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async triggerWebhookRecovery(): Promise<void> {
    try {
      console.log('🔄 Triggering webhook recovery...');

      // Stop and restart webhook service to force tunnel recreation
      if (this.webhookService) {
        await this.webhookService.stop();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Brief pause
        await this.webhookService.start();
      }

      // Reset failure counter after triggering recovery
      this.consecutiveFailures = 0;

      console.log('✅ Webhook recovery triggered successfully');
    } catch (error) {
      console.error('❌ Failed to trigger webhook recovery:', error);
    }
  }

  private notifyHealthStatus(status: 'healthy' | 'degraded' | 'critical', data: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(APP_CONSTANTS.IPC_CHANNELS.WEBHOOK_HEALTH_CHANGED, {
        status,
        ...data
      });
    }
  }

  // Manual health check trigger (for testing)
  async performManualHealthCheck(): Promise<boolean> {
    try {
      await this.performHealthCheck();
      return this.consecutiveFailures === 0;
    } catch (error) {
      console.error('❌ Manual health check failed:', error);
      return false;
    }
  }
}