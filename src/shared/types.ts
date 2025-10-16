// Shared types between main and renderer processes
import { UserRole } from './constants/roles';

export interface WindowConfig {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  backgroundColor: string;
}

export interface GoogleDriveConfig {
  projectId: string;
  privateKeyId?: string;
  privateKey?: string;
  clientEmail?: string;
  clientId?: string;
  folderId?: string;
}

export interface WebhookConfig {
  subdomain?: string;
  localHost: string;
  enableRemoteAccess?: boolean;  // For future Cloudflare tunnel
}

export interface OpenAIConfig {
  apiKey: string;
}

export interface AppConfig {
  window: WindowConfig;
  googleDrive: GoogleDriveConfig;
  webhook: WebhookConfig;
  openai: OpenAIConfig;
  isDevelopment: boolean;
}

// Common base types
export interface BaseEntity {
  id: string;  // UUID
}

// File-related types
export interface FileInfo {
  fileName: string;
  filePath?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt?: string;
  timestamp: string;
  resourceId?: string;
  channelId?: string;
  source?: string;
}

// Task-related types
export interface Task extends BaseEntity {
  title: string;
  clientName: string;  // Display name for UI
  clientId?: string;   // Database foreign key (UUID)
  assignee: string;
  status: 'pending' | 'in_progress' | 'completed' | 'on_hold';
  startDate: string;
  dueDate: string;
  createdAt: string;
  progress: number;
  category: string;
  tags?: string[];
}

export interface TaskFilter {
  status?: Task['status'][];
  assignee?: string[];
  client?: string[];
  searchQuery?: string;
}

// Client-related types
export interface Client extends BaseEntity {
  companyName: string;
  representative: string;
  businessRegistrationNumber: string;
  contactNumber: string;
  email: string;
  address: string;
  assignee: string;
  contractDate: string;
  status: 'active' | 'inactive' | 'contract_expired';
  notes?: string;
  tpCode?: string;
}

export interface ClientFilter {
  status?: Client['status'][];
  assignee?: string[];
  searchQuery?: string;
}

// Call-related types
export interface Call extends BaseEntity {
  date: string;
  callerName: string;
  clientName: string | null;
  phoneNumber: string;
  recordingFileName: string;
  transcriptFileName: string;
  callDuration: string;
  transcript?: string | null;
}

export interface CallFilter {
  dateRange?: {
    start: string;
    end: string;
  };
  caller?: string[];
  client?: string[];
  searchQuery?: string;
}

// User types
export interface User extends BaseEntity {
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  tpCode?: string;
  createdAt: string;
  updatedAt: string;
}

// Subtask types
export interface Subtask extends BaseEntity {
  taskId: string;
  title: string;
  assignee?: string;
  status: 'pending' | 'in_progress' | 'completed';
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

// Message/Conversation types
export interface Message extends BaseEntity {
  userId: string;
  content: string;
  timestamp: string;
  // Context - only one will be set
  taskId?: string;
  clientId?: string;
  callId?: string;
  // Relations
  user?: User;
}

// Legacy message interface for backward compatibility
export interface LegacyMessage extends BaseEntity {
  sender: string;
  timestamp: string;
  content: string;
  type?: 'user' | 'taxia' | 'system';
  icon?: string;
  tasks?: ConversationTask[];
}

export interface ConversationTask {
  id: string;
  title: string;
  checked: boolean;
  deadline: string;
}

// IPC Events
export interface IPCEvents {
  'file-detected': (fileInfo: FileInfo) => void;
  'file-processed': (data: { content: string; accuracy: number }) => void;
  'google-drive-auth-needed': (data: { authUrl: string }) => void;
  'tasks-extracted': (data: { tasks: ConversationTask[] }) => void;
  'create-new-call': (data: { callData: Call; fileName: string; timestamp: string }) => void;
  'conversation-message': (data: {
    fileName: string;
    message: Message;
    messageIndex: number;
    totalMessages: number;
    timestamp: string;
  }) => void;
}

// Electron API interface
export interface ElectronAPI {
  // Window controls
  windowClose: () => Promise<void>;
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<void>;

  // Authentication
  loginSuccess?: (userData: any) => void;
  loginWindowClose?: () => Promise<void>;
  authLogin: (credentials: { email: string; password: string }) => Promise<{ success: boolean; user?: User; error?: string }>;
  authSignup: (userData: { name: string; email: string; password: string }) => Promise<{ success: boolean; user?: User; error?: string }>;
  logout: () => Promise<void>;
  restoreMainWindow: () => Promise<void>;

  // Google Drive integration
  googleDriveAuthCode: (code: string) => Promise<boolean>;
  googleDriveWatchFolder: (folderId: string) => Promise<boolean>;

  // Database operations
  getAllClients: () => Promise<Client[]>;
  getAllCalls: () => Promise<Call[]>;
  getAllTasks: () => Promise<Task[]>;
  createClient: (clientData: Omit<Client, 'id'>) => Promise<Client>;
  updateClient: (clientId: string, clientData: Partial<Omit<Client, 'id'>>) => Promise<Client>;
  createCall: (callData: Omit<Call, 'id'>) => Promise<Call>;
  createTask: (taskData: Omit<Task, 'id' | 'createdAt'>) => Promise<Task>;
  updateTask: (taskId: string, taskData: Partial<Omit<Task, 'id' | 'createdAt'>>) => Promise<Task>;

  // User operations
  getAllUsers: () => Promise<User[]>;
  getAllHumanUsers: () => Promise<User[]>;
  createUser: (userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) => Promise<User>;
  updateUser: (userId: string, userData: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<User>;
  getUserByRole: (role: string) => Promise<User | null>;

  // Subtask operations
  getSubtasksByTaskId: (taskId: string) => Promise<Subtask[]>;
  createSubtask: (subtaskData: Omit<Subtask, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Subtask>;
  updateSubtask: (subtaskId: string, subtaskData: Partial<Omit<Subtask, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<Subtask>;

  // Delete operations
  deleteClient: (clientId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  deleteSubtask: (subtaskId: string) => Promise<void>;

  // Message operations
  getMessagesByContext: (context: { taskId?: string; clientId?: string; callId?: string }) => Promise<Message[]>;
  createMessage: (messageData: Omit<Message, 'id' | 'timestamp'>) => Promise<Message>;

  // Settings operations (database)
  getSetting: (key: string) => Promise<string | null>;
  setSetting: (key: string, value: string) => Promise<void>;
  getAllSettings: () => Promise<Record<string, string>>;

  // Config operations (electron-store)
  setCompanyName: (name: string) => Promise<void>;
  setGoogleDriveFolderId: (folderId: string) => Promise<void>;

  // File operations
  getAudioFilePath: (fileName: string) => Promise<string | null>;

  // Event listeners
  onFileDetected: (callback: IPCEvents['file-detected']) => void;
  onFileProcessed: (callback: IPCEvents['file-processed']) => void;
  onTasksExtracted: (callback: IPCEvents['tasks-extracted']) => void;
  onGoogleDriveAuthNeeded: (callback: IPCEvents['google-drive-auth-needed']) => void;
  onCreateNewCall: (callback: IPCEvents['create-new-call']) => void;
  onConversationMessage: (callback: IPCEvents['conversation-message']) => void;
  onWebhookStatusChanged?: (callback: (data: any) => void) => void;
  onWebhookHealthChanged?: (callback: (data: any) => void) => void;
  removeAllListeners: (channel: string) => void;
}

// Table and UI types
export interface Column<T = any> {
  key: string;
  label: string;
  width: number;
  minWidth?: number;
  render?: (value: any, item: T) => React.ReactNode;
}

export interface FormField {
  label: string;
  value: string | number | null;
  type?: 'text' | 'select' | 'textarea' | 'date' | 'number';
  options?: { value: string; label: string }[];
  placeholder?: string;
  readOnly?: boolean;
  required?: boolean;
  className?: string;
}

// React component prop types
export interface SelectableItem {
  id: number | string;
}

export interface TableProps<T extends SelectableItem> {
  data: T[];
  columns: Column<T>[];
  selectedItem?: T | null;
  onItemSelect?: (item: T) => void;
  loading?: boolean;
  emptyStateText?: string;
}

export interface FilterProps<T> {
  filters: T;
  onFiltersChange: (filters: T) => void;
  onClearFilters: () => void;
}