import { BrowserWindow } from 'electron';
import { FileInfo, Task, Client, Call } from '../../shared/types';
import { LocalFileInfo } from './fileDetection.service';

// Base service interface that all services should implement
export interface BaseService {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}

// Webhook service interface (kept for API endpoints, not for Google Drive webhooks)
export interface WebhookServiceInterface extends BaseService {
  getWebhookUrl(): string | null;
}

// OpenAI service interface
export interface OpenAIServiceInterface extends BaseService {
  transcribeAudio(audioFilePath: string): Promise<string>;
  extractTasks(transcript: string, clientName?: string): Promise<Task[]>;
}

// Database service interface
export interface DatabaseServiceInterface extends BaseService {
  getAllClients(): Promise<Client[]>;
  createClient(clientData: Omit<Client, 'id'>): Promise<Client>;
  updateClient(clientId: string, clientData: Partial<Omit<Client, 'id'>>): Promise<Client>;
  getAllCalls(): Promise<Call[]>;
  createCall(callData: Omit<Call, 'id'> & { clientId?: string; userId?: string; transcript?: string }): Promise<Call>;
  updateCallTranscript(callId: string, transcript: string): Promise<void>;
  getAllTasks(): Promise<Task[]>;
  createTask(taskData: Omit<Task, 'id' | 'createdAt'> & { callId?: string; clientId?: string }): Promise<Task>;
  createTasksFromCall(callId: string, tasks: Omit<Task, 'id' | 'createdAt'>[]): Promise<Task[]>;
  findClientByName(companyName: string): Promise<Client | null>;
  seedMockData(): Promise<void>;

  // TP Recording Integration helpers
  getUserByTpCode(tpCode: string): Promise<any | null>;
  getClientByTpCode(tpCode: string): Promise<Client | null>;
  getClientByPhone(phoneNumber: string): Promise<Client | null>;
  getCallByFileName(fileName: string): Promise<Call | null>;
  updateCallFileExists(callId: string, fileExists: boolean): Promise<void>;
  getUserByRole(role: string): Promise<any | null>;
  createUser(userData: { name: string; email: string; password: string; role: string; avatar?: string }): Promise<any>;
  createMessage(messageData: { userId: string; content: string; taskId?: string; clientId?: string; callId?: string; metadata?: string }): Promise<any>;
}

// File detection handler interface (updated for local files)
export interface FileDetectionHandlerInterface {
  handleFileDetected(fileInfo: LocalFileInfo): void;
  setOpenAIService(service: OpenAIServiceInterface): void;
  setDatabaseService(service: DatabaseServiceInterface): void;
}

// Local folder watcher interface (NEW)
export interface LocalFolderWatcherInterface extends BaseService {
  setFileDetectionHandler(handler: FileDetectionHandlerInterface): void;
  getWatchedFolder(): string | null;
}

// Service factory interface (updated)
export interface ServiceFactoryInterface {
  createWebhookService(mainWindow: BrowserWindow): WebhookServiceInterface;
  createLocalFolderWatcher(mainWindow: BrowserWindow): LocalFolderWatcherInterface;
  createFileDetectionHandler(mainWindow: BrowserWindow): FileDetectionHandlerInterface;
}
