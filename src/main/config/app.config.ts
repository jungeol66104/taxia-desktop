import { AppConfig } from '../../shared/types';
import { APP_CONSTANTS } from '../../shared/constants';

export function createAppConfig(): AppConfig {
  // All secrets are now stored in database (AppSettings table)
  // No environment variables needed for production builds

  return {
    window: {
      width: APP_CONSTANTS.WINDOW.DEFAULT_WIDTH,
      height: APP_CONSTANTS.WINDOW.DEFAULT_HEIGHT,
      minWidth: APP_CONSTANTS.WINDOW.MIN_WIDTH,
      minHeight: APP_CONSTANTS.WINDOW.MIN_HEIGHT,
      backgroundColor: APP_CONSTANTS.WINDOW.BACKGROUND_COLOR,
    },

    googleDrive: {
      projectId: APP_CONSTANTS.GOOGLE_DRIVE.DEFAULT_PROJECT_ID,
      privateKeyId: undefined,
      privateKey: undefined,
      clientEmail: undefined,
      clientId: undefined,
      folderId: undefined,
    },

    webhook: {
      subdomain: undefined,
      localHost: APP_CONSTANTS.WEBHOOK.LOCAL_HOST,
      enableRemoteAccess: false,  // Disabled by default, can be enabled in settings
    },

    openai: {
      apiKey: '', // Will be loaded from database
    },

    isDevelopment: process.env.NODE_ENV !== 'production',
  };
}

export function validateConfig(config: AppConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Only validate window configuration (critical for app to start)
  if (config.window.width < config.window.minWidth) {
    errors.push('Window width cannot be less than minimum width');
  }

  if (config.window.height < config.window.minHeight) {
    errors.push('Window height cannot be less than minimum height');
  }

  // Google Drive and OpenAI are optional - only needed for server mode
  // Client mode doesn't need these env vars

  return {
    isValid: errors.length === 0,
    errors,
  };
}