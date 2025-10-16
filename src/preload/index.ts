import { contextBridge, ipcRenderer } from 'electron';
import { APP_CONSTANTS } from '../shared/constants';

console.log('🔧 PRELOAD: Script is loading...');
console.log('🔧 PRELOAD: process.contextIsolated:', process.contextIsolated);

const electronAPI = {
  // Window controls
  windowClose: () => ipcRenderer.invoke(APP_CONSTANTS.IPC_CHANNELS.WINDOW_CLOSE),
  windowMinimize: () => ipcRenderer.invoke(APP_CONSTANTS.IPC_CHANNELS.WINDOW_MINIMIZE),
  windowMaximize: () => ipcRenderer.invoke(APP_CONSTANTS.IPC_CHANNELS.WINDOW_MAXIMIZE),

  // Local Folder Watcher
  folderWatcher: {
    selectFolder: () => ipcRenderer.invoke('folder-watcher:select-folder'),
    start: (folderPath: string) => ipcRenderer.invoke('folder-watcher:start', folderPath),
    stop: () => ipcRenderer.invoke('folder-watcher:stop'),
    getStatus: () => ipcRenderer.invoke('folder-watcher:get-status'),
  },

  // File detection events
  onFileDetected: (callback: (fileInfo: any) => void) => {
    ipcRenderer.on(APP_CONSTANTS.IPC_CHANNELS.FILE_DETECTED, (event, fileInfo) => callback(fileInfo));
  },
  onConversationMessage: (callback: (data: any) => void) => {
    ipcRenderer.on(APP_CONSTANTS.IPC_CHANNELS.CONVERSATION_MESSAGE, (event, data) => callback(data));
  },
  onCreateNewCall: (callback: (data: any) => void) => {
    ipcRenderer.on(APP_CONSTANTS.IPC_CHANNELS.CREATE_NEW_CALL, (event, data) => callback(data));
  },
  onFileProcessed: (callback: (data: any) => void) => {
    ipcRenderer.on(APP_CONSTANTS.IPC_CHANNELS.FILE_PROCESSED, (event, data) => callback(data));
  },
  onTasksExtracted: (callback: (data: any) => void) => {
    ipcRenderer.on(APP_CONSTANTS.IPC_CHANNELS.TASKS_EXTRACTED, (event, data) => callback(data));
  },
  onTranscriptUpdated: (callback: (data: any) => void) => {
    ipcRenderer.on(APP_CONSTANTS.IPC_CHANNELS.TRANSCRIPT_UPDATED, (event, data) => callback(data));
  },

  // Webhook status events
  onWebhookStatusChanged: (callback: (data: any) => void) => {
    ipcRenderer.on(APP_CONSTANTS.IPC_CHANNELS.WEBHOOK_STATUS_CHANGED, (event, data) => callback(data));
  },
  onWebhookHealthChanged: (callback: (data: any) => void) => {
    ipcRenderer.on(APP_CONSTANTS.IPC_CHANNELS.WEBHOOK_HEALTH_CHANGED, (event, data) => callback(data));
  },

  // Authentication
  loginSuccess: (userData: any) => ipcRenderer.send('login-success', userData),
  loginWindowClose: () => ipcRenderer.invoke('login-window-close'),
  setupComplete: () => ipcRenderer.invoke('setup-complete'),
  authLogin: (credentials: { email: string; password: string }) => ipcRenderer.invoke('auth:login', credentials),
  authSignup: (userData: { name: string; email: string; password: string }) => ipcRenderer.invoke('auth:signup', userData),
  logout: () => ipcRenderer.invoke('logout'),
  restoreMainWindow: () => ipcRenderer.invoke('restore-main-window'),

  // Database operations
  getAllClients: () => ipcRenderer.invoke(APP_CONSTANTS.IPC_CHANNELS.DB_GET_CLIENTS),
  getAllCalls: () => ipcRenderer.invoke(APP_CONSTANTS.IPC_CHANNELS.DB_GET_CALLS),
  getAllTasks: () => ipcRenderer.invoke(APP_CONSTANTS.IPC_CHANNELS.DB_GET_TASKS),
  createClient: (clientData: any) => ipcRenderer.invoke(APP_CONSTANTS.IPC_CHANNELS.DB_CREATE_CLIENT, clientData),
  updateClient: (clientId: string, clientData: any) => ipcRenderer.invoke(APP_CONSTANTS.IPC_CHANNELS.DB_UPDATE_CLIENT, clientId, clientData),
  createCall: (callData: any) => ipcRenderer.invoke(APP_CONSTANTS.IPC_CHANNELS.DB_CREATE_CALL, callData),
  createTask: (taskData: any) => ipcRenderer.invoke(APP_CONSTANTS.IPC_CHANNELS.DB_CREATE_TASK, taskData),
  updateTask: (taskId: string, taskData: any) => ipcRenderer.invoke(APP_CONSTANTS.IPC_CHANNELS.DB_UPDATE_TASK, taskId, taskData),
  deleteClient: (clientId: string) => ipcRenderer.invoke(APP_CONSTANTS.IPC_CHANNELS.DB_DELETE_CLIENT, clientId),
  deleteTask: (taskId: string) => ipcRenderer.invoke(APP_CONSTANTS.IPC_CHANNELS.DB_DELETE_TASK, taskId),
  deleteSubtask: (subtaskId: string) => ipcRenderer.invoke(APP_CONSTANTS.IPC_CHANNELS.DB_DELETE_SUBTASK, subtaskId),

  // User operations
  getAllUsers: () => ipcRenderer.invoke('db:get-users'),
  getAllHumanUsers: () => ipcRenderer.invoke('db:get-human-users'),
  createUser: (userData: any) => ipcRenderer.invoke('db:create-user', userData),
  updateUser: (userId: string, userData: any) => ipcRenderer.invoke(APP_CONSTANTS.IPC_CHANNELS.DB_UPDATE_USER, userId, userData),
  getUserByRole: (role: string) => ipcRenderer.invoke('db:get-user-by-role', role),

  // Subtask operations
  getSubtasksByTaskId: (taskId: string) => ipcRenderer.invoke('db:get-subtasks-by-task', taskId),
  createSubtask: (subtaskData: any) => ipcRenderer.invoke('db:create-subtask', subtaskData),
  updateSubtask: (subtaskId: string, subtaskData: any) => ipcRenderer.invoke(APP_CONSTANTS.IPC_CHANNELS.DB_UPDATE_SUBTASK, subtaskId, subtaskData),

  // Message operations
  getMessagesByContext: (context: any) => ipcRenderer.invoke('db:get-messages-by-context', context),
  createMessage: (messageData: any) => ipcRenderer.invoke('db:create-message', messageData),

  // Settings operations (database)
  getSetting: (key: string) => ipcRenderer.invoke(APP_CONSTANTS.IPC_CHANNELS.DB_GET_SETTING, key),
  setSetting: (key: string, value: string) => ipcRenderer.invoke(APP_CONSTANTS.IPC_CHANNELS.DB_SET_SETTING, key, value),
  getAllSettings: () => ipcRenderer.invoke(APP_CONSTANTS.IPC_CHANNELS.DB_GET_ALL_SETTINGS),

  // Config operations (electron-store)
  setCompanyName: (name: string) => ipcRenderer.invoke('config:set-company-name', name),

  // Debug operations
  checkDatabaseSetup: () => ipcRenderer.invoke('debug:check-database-setup'),

  // File path operations
  getDefaultDownloadPath: () => ipcRenderer.invoke('app:get-default-download-path'),
  setDownloadPath: (path: string) => ipcRenderer.invoke('app:set-download-path', path),
  selectFolder: () => ipcRenderer.invoke('app:select-folder'),
  getCurrentUser: () => ipcRenderer.invoke('app:get-current-user'),
  getSessionInfo: () => ipcRenderer.invoke('app:get-session-info'),
  getAudioFilePath: (fileName: string) => ipcRenderer.invoke('app:get-audio-file-path', fileName),
  getLocalUrl: () => ipcRenderer.invoke('app:get-local-url'),

  // Factory reset
  factoryReset: () => ipcRenderer.invoke('app:factory-reset'),

  // Cleanup listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
};

// Recommended approach based on Electron documentation
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI);
    console.log('🔧 PRELOAD: electronAPI exposed via contextBridge (context isolated)');
  } catch (error) {
    console.error('🔧 PRELOAD: Failed to expose via contextBridge:', error);
  }
} else {
  // Fallback for non-context-isolated environment
  (window as any).electronAPI = electronAPI;
  console.log('🔧 PRELOAD: electronAPI assigned to window directly (non-context isolated)');
}

console.log('🔧 PRELOAD: electronAPI setup complete');
