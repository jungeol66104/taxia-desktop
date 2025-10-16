// Shared constants between main and renderer processes

export const APP_CONSTANTS = {
  WINDOW: {
    DEFAULT_WIDTH: 1400,
    DEFAULT_HEIGHT: 900,
    MIN_WIDTH: 1200,
    MIN_HEIGHT: 800,
    BACKGROUND_COLOR: '#004492',
    TITLE_BAR_HEIGHT: 40,
  },

  WEBHOOK: {
    DEFAULT_PORT: 3000,
    LOCAL_HOST: 'localhost',
    TUNNEL_PREFIX: 'taxia-',
  },

  GOOGLE_DRIVE: {
    DEFAULT_PROJECT_ID: 'taxia-desktop',
    SCOPES: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.metadata.readonly'
    ],
  },

  IPC_CHANNELS: {
    // Window controls
    WINDOW_CLOSE: 'window-close',
    WINDOW_MINIMIZE: 'window-minimize',
    WINDOW_MAXIMIZE: 'window-maximize',

    // Google Drive OAuth
    GOOGLE_DRIVE_CONNECT: 'google-drive-connect',
    GOOGLE_DRIVE_DISCONNECT: 'google-drive-disconnect',
    GOOGLE_DRIVE_GET_STATUS: 'google-drive-get-status',
    GOOGLE_DRIVE_SET_FOLDER: 'google-drive-set-folder',
    GOOGLE_DRIVE_LIST_FOLDERS: 'google-drive-list-folders',
    GOOGLE_DRIVE_VERIFY_FOLDER: 'google-drive-verify-folder',
    GOOGLE_DRIVE_START_WATCHING: 'google-drive-start-watching',
    GOOGLE_DRIVE_STOP_WATCHING: 'google-drive-stop-watching',

    // File operations
    FILE_DETECTED: 'file-detected',
    FILE_PROCESSED: 'file-processed',
    TASKS_EXTRACTED: 'tasks-extracted',
    CREATE_NEW_CALL: 'create-new-call',
    TRANSCRIPT_UPDATED: 'transcript-updated',
    CONVERSATION_MESSAGE: 'conversation-message',
    GOOGLE_DRIVE_AUTH_NEEDED: 'google-drive-auth-needed',

    // Webhook status
    WEBHOOK_STATUS_CHANGED: 'webhook-status-changed',
    WEBHOOK_HEALTH_CHANGED: 'webhook-health-changed',

    // Database operations
    DB_GET_CLIENTS: 'db-get-clients',
    DB_GET_CALLS: 'db-get-calls',
    DB_GET_TASKS: 'db-get-tasks',
    DB_CREATE_CLIENT: 'db-create-client',
    DB_UPDATE_CLIENT: 'db-update-client',
    DB_CREATE_CALL: 'db-create-call',
    DB_CREATE_TASK: 'db-create-task',
    DB_UPDATE_TASK: 'db-update-task',
    DB_UPDATE_USER: 'db-update-user',
    DB_UPDATE_SUBTASK: 'db-update-subtask',
    DB_DELETE_CLIENT: 'db-delete-client',
    DB_DELETE_TASK: 'db-delete-task',
    DB_DELETE_SUBTASK: 'db-delete-subtask',

    // Settings operations
    DB_GET_SETTING: 'db-get-setting',
    DB_SET_SETTING: 'db-set-setting',
    DB_GET_ALL_SETTINGS: 'db-get-all-settings',
  },

  UI: {
    SIDEBAR_WIDTH: 70,
    PANEL_HEADER_HEIGHT: 48,
    TAB_ICON_SIZE: 24,
    BORDER_RADIUS: 8,
  },

  TIMING: {
    MESSAGE_INTERVAL_MS: 2000,
    TUNNEL_RECONNECT_DELAY_MS: 5000,
    TUNNEL_RETRY_DELAY_MS: 10000,
    FALLBACK_SHOW_DELAY_MS: 2000,
    ALWAYS_ON_TOP_DURATION_MS: 1000,
  },
} as const;

export const DEFAULT_TASKS = [
  {
    id: 'corporate-tax-report',
    title: 'Corporate tax report draft',
    checked: true,
    deadline: '2024-09-23'
  },
  {
    id: 'meeting-schedule',
    title: 'Schedule and book meeting',
    checked: true,
    deadline: '2024-09-21'
  },
  {
    id: 'document-preparation',
    title: 'Prepare required documents',
    checked: false,
    deadline: '2024-09-25'
  }
] as const;

export const MOCK_CLIENTS = [
  {
    id: 1,
    companyName: 'Hyundai Steel Co., Ltd.',
    representative: 'Kim Chul-soo',
    businessRegistrationNumber: '123-45-67890',
    contactNumber: '02-1234-5678',
    email: 'contact@hyundaisteel.com',
    address: 'Seoul, Gangnam-gu',
    assignee: 'Park Manager',
    contractDate: '2024-01-15',
    status: 'active' as const,
  }
] as const;

export const MOCK_CALLS = [
  {
    id: 1,
    date: '2024-09-20',
    callerName: 'Kim Chul-soo',
    clientName: 'Hyundai Steel Co., Ltd.',
    phoneNumber: '02-1234-5678',
    recordingFileName: 'call_20240920_001.wav',
    transcriptFileName: 'call_20240920_001.txt',
    callDuration: '5:30',
  }
] as const;