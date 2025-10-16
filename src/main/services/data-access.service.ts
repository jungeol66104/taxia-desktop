/**
 * Data Access Service
 *
 * Routes data operations to either local database (server mode)
 * or HTTP client (client mode) based on app mode.
 */

import { DatabaseServiceInterface } from './interfaces';
import { HttpClientService } from './http-client.service';

export class DataAccessService {
  private databaseService: DatabaseServiceInterface | null = null;
  private httpClient: HttpClientService | null = null;
  private isServerMode: boolean = true;

  setDatabaseService(service: DatabaseServiceInterface): void {
    this.databaseService = service;
  }

  setHttpClient(client: HttpClientService): void {
    this.httpClient = client;
  }

  setMode(isServer: boolean): void {
    this.isServerMode = isServer;
    console.log(`🔀 Data access mode: ${isServer ? 'SERVER (local DB)' : 'CLIENT (HTTP)'}`);
  }

  // ===========================================
  // Client Operations
  // ===========================================

  async getAllClients(): Promise<any[]> {
    if (this.isServerMode && this.databaseService) {
      return this.databaseService.getAllClients();
    } else if (!this.isServerMode && this.httpClient) {
      return this.httpClient.getAllClients();
    }
    throw new Error('No data service available');
  }

  async createClient(clientData: any): Promise<any> {
    if (this.isServerMode && this.databaseService) {
      return this.databaseService.createClient(clientData);
    } else if (!this.isServerMode && this.httpClient) {
      return this.httpClient.createClient(clientData);
    }
    throw new Error('No data service available');
  }

  async updateClient(clientId: string, clientData: any): Promise<any> {
    if (this.isServerMode && this.databaseService) {
      return this.databaseService.updateClient(clientId, clientData);
    } else if (!this.isServerMode && this.httpClient) {
      return this.httpClient.updateClient(clientId, clientData);
    }
    throw new Error('No data service available');
  }

  async deleteClient(clientId: string): Promise<void> {
    if (this.isServerMode && this.databaseService) {
      return this.databaseService.deleteClient(clientId);
    } else if (!this.isServerMode && this.httpClient) {
      return this.httpClient.deleteClient(clientId);
    }
    throw new Error('No data service available');
  }

  // ===========================================
  // Task Operations
  // ===========================================

  async getAllTasks(): Promise<any[]> {
    if (this.isServerMode && this.databaseService) {
      return this.databaseService.getAllTasks();
    } else if (!this.isServerMode && this.httpClient) {
      return this.httpClient.getAllTasks();
    }
    throw new Error('No data service available');
  }

  async createTask(taskData: any): Promise<any> {
    if (this.isServerMode && this.databaseService) {
      return this.databaseService.createTask(taskData);
    } else if (!this.isServerMode && this.httpClient) {
      return this.httpClient.createTask(taskData);
    }
    throw new Error('No data service available');
  }

  async updateTask(taskId: string, taskData: any): Promise<any> {
    if (this.isServerMode && this.databaseService) {
      return this.databaseService.updateTask(taskId, taskData);
    } else if (!this.isServerMode && this.httpClient) {
      return this.httpClient.updateTask(taskId, taskData);
    }
    throw new Error('No data service available');
  }

  async deleteTask(taskId: string): Promise<void> {
    if (this.isServerMode && this.databaseService) {
      return this.databaseService.deleteTask(taskId);
    } else if (!this.isServerMode && this.httpClient) {
      return this.httpClient.deleteTask(taskId);
    }
    throw new Error('No data service available');
  }

  // ===========================================
  // Call Operations
  // ===========================================

  async getAllCalls(): Promise<any[]> {
    if (this.isServerMode && this.databaseService) {
      return this.databaseService.getAllCalls();
    } else if (!this.isServerMode && this.httpClient) {
      return this.httpClient.getAllCalls();
    }
    throw new Error('No data service available');
  }

  async createCall(callData: any): Promise<any> {
    if (this.isServerMode && this.databaseService) {
      return this.databaseService.createCall(callData);
    } else if (!this.isServerMode && this.httpClient) {
      return this.httpClient.createCall(callData);
    }
    throw new Error('No data service available');
  }

  // ===========================================
  // User Operations
  // ===========================================

  async getAllUsers(): Promise<any[]> {
    if (this.isServerMode && this.databaseService) {
      return this.databaseService.getAllUsers();
    } else if (!this.isServerMode && this.httpClient) {
      return this.httpClient.getAllUsers();
    }
    throw new Error('No data service available');
  }

  async createUser(userData: any): Promise<any> {
    if (this.isServerMode && this.databaseService) {
      return this.databaseService.createUser(userData);
    } else if (!this.isServerMode && this.httpClient) {
      return this.httpClient.createUser(userData);
    }
    throw new Error('No data service available');
  }

  async updateUser(userId: string, userData: any): Promise<any> {
    if (this.isServerMode && this.databaseService) {
      return this.databaseService.updateUser(userId, userData);
    } else if (!this.isServerMode && this.httpClient) {
      return this.httpClient.updateUser(userId, userData);
    }
    throw new Error('No data service available');
  }

  // ===========================================
  // Message Operations
  // ===========================================

  async getMessagesByContext(context: { taskId?: string; clientId?: string; callId?: string }): Promise<any[]> {
    if (this.isServerMode && this.databaseService) {
      return this.databaseService.getMessagesByContext(context);
    } else if (!this.isServerMode && this.httpClient) {
      return this.httpClient.getMessagesByContext(context);
    }
    throw new Error('No data service available');
  }

  async createMessage(messageData: any): Promise<any> {
    if (this.isServerMode && this.databaseService) {
      return this.databaseService.createMessage(messageData);
    } else if (!this.isServerMode && this.httpClient) {
      return this.httpClient.createMessage(messageData);
    }
    throw new Error('No data service available');
  }

  // ===========================================
  // Subtask Operations
  // ===========================================

  async getSubtasksByTaskId(taskId: string): Promise<any[]> {
    if (this.isServerMode && this.databaseService) {
      return this.databaseService.getSubtasksByTaskId(taskId);
    } else if (!this.isServerMode && this.httpClient) {
      return this.httpClient.getSubtasksByTaskId(taskId);
    }
    throw new Error('No data service available');
  }

  async createSubtask(subtaskData: any): Promise<any> {
    if (this.isServerMode && this.databaseService) {
      return this.databaseService.createSubtask(subtaskData);
    } else if (!this.isServerMode && this.httpClient) {
      return this.httpClient.createSubtask(subtaskData);
    }
    throw new Error('No data service available');
  }

  async updateSubtask(subtaskId: string, subtaskData: any): Promise<any> {
    if (this.isServerMode && this.databaseService) {
      return this.databaseService.updateSubtask(subtaskId, subtaskData);
    } else if (!this.isServerMode && this.httpClient) {
      return this.httpClient.updateSubtask(subtaskId, subtaskData);
    }
    throw new Error('No data service available');
  }

  async deleteSubtask(subtaskId: string): Promise<void> {
    if (this.isServerMode && this.databaseService) {
      return this.databaseService.deleteSubtask(subtaskId);
    } else if (!this.isServerMode && this.httpClient) {
      return this.httpClient.deleteSubtask(subtaskId);
    }
    throw new Error('No data service available');
  }

  // ===========================================
  // Settings Operations
  // ===========================================

  async getSetting(key: string): Promise<string | null> {
    if (this.isServerMode && this.databaseService) {
      return this.databaseService.getSetting(key);
    } else if (!this.isServerMode && this.httpClient) {
      return this.httpClient.getSetting(key);
    }
    throw new Error('No data service available');
  }

  async setSetting(key: string, value: string): Promise<void> {
    if (this.isServerMode && this.databaseService) {
      return this.databaseService.setSetting(key, value);
    } else if (!this.isServerMode && this.httpClient) {
      return this.httpClient.setSetting(key, value);
    }
    throw new Error('No data service available');
  }

  async getAllSettings(): Promise<Record<string, string>> {
    if (this.isServerMode && this.databaseService) {
      const settings = await this.databaseService.getAllSettings();
      // Convert array to object
      const result: Record<string, string> = {};
      settings.forEach((s: any) => {
        result[s.key] = s.value;
      });
      return result;
    } else if (!this.isServerMode && this.httpClient) {
      return this.httpClient.getAllSettings();
    }
    throw new Error('No data service available');
  }
}
