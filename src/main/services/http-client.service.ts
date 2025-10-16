/**
 * HTTP Client Service
 *
 * Makes HTTP requests to the server API when running in client mode.
 * This allows client devices to access data from the server over the network.
 */

export class HttpClientService {
  private serverUrl: string;
  private authToken: string | null = null;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
    console.log(`🌐 HTTP Client initialized for server: ${this.serverUrl}`);
  }

  /**
   * Update the server URL
   */
  setServerUrl(url: string): void {
    this.serverUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    console.log(`🌐 Server URL updated: ${this.serverUrl}`);
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    this.authToken = token;
    console.log('🔑 Auth token set');
  }

  /**
   * Clear authentication token
   */
  clearAuthToken(): void {
    this.authToken = null;
    console.log('🔑 Auth token cleared');
  }

  /**
   * Make HTTP request with error handling, timeout, and retry logic
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: any,
    timeout: number = 10000
  ): Promise<T> {
    const url = `${this.serverUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // Add auth token if available
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    try {
      console.log(`📡 ${method} ${url}`);

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorBody = await response.text();
          if (errorBody) {
            errorMessage += ` - ${errorBody.slice(0, 200)}`;
          }
        } catch {
          // Ignore error body parse failures
        }
        throw new Error(errorMessage);
      }

      // Validate content type is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Expected JSON response, got ${contentType}. Body: ${text.slice(0, 100)}`);
      }

      const data = await response.json();
      return data as T;

    } catch (error: any) {
      // Handle timeout
      if (error.name === 'AbortError') {
        console.error(`❌ HTTP request timeout: ${method} ${url}`);
        throw new Error(`Request timeout (${timeout}ms)`);
      }

      // Handle network errors
      if (error.message?.includes('fetch')) {
        console.error(`❌ Network error: ${method} ${url}`, error);
        throw new Error('Network error. Please check your connection.');
      }

      console.error(`❌ HTTP request failed: ${method} ${url}`, error);
      throw error;
    }
  }

  // ===========================================
  // Authentication API
  // ===========================================

  async login(email: string, password: string): Promise<{ success: boolean; token?: string; user?: any; message?: string }> {
    const result = await this.request<any>('POST', '/api/auth/login', { email, password });

    // Store token if login successful
    if (result.success && result.token) {
      this.setAuthToken(result.token);
    }

    return result;
  }

  async validateSession(): Promise<{ success: boolean; user?: any }> {
    return this.request<any>('GET', '/api/auth/session');
  }

  // ===========================================
  // Client API
  // ===========================================

  async getAllClients(): Promise<any[]> {
    return this.request<any[]>('GET', '/api/clients');
  }

  async getClient(id: string): Promise<any> {
    return this.request<any>('GET', `/api/clients/${id}`);
  }

  async createClient(clientData: any): Promise<any> {
    return this.request<any>('POST', '/api/clients', clientData);
  }

  async updateClient(id: string, clientData: any): Promise<any> {
    return this.request<any>('PUT', `/api/clients/${id}`, clientData);
  }

  async deleteClient(id: string): Promise<void> {
    await this.request<void>('DELETE', `/api/clients/${id}`);
  }

  // ===========================================
  // Task API
  // ===========================================

  async getAllTasks(): Promise<any[]> {
    return this.request<any[]>('GET', '/api/tasks');
  }

  async getTask(id: string): Promise<any> {
    return this.request<any>('GET', `/api/tasks/${id}`);
  }

  async createTask(taskData: any): Promise<any> {
    return this.request<any>('POST', '/api/tasks', taskData);
  }

  async updateTask(id: string, taskData: any): Promise<any> {
    return this.request<any>('PUT', `/api/tasks/${id}`, taskData);
  }

  async deleteTask(id: string): Promise<void> {
    await this.request<void>('DELETE', `/api/tasks/${id}`);
  }

  // ===========================================
  // Call API
  // ===========================================

  async getAllCalls(): Promise<any[]> {
    return this.request<any[]>('GET', '/api/calls');
  }

  async getCall(id: string): Promise<any> {
    return this.request<any>('GET', `/api/calls/${id}`);
  }

  async createCall(callData: any): Promise<any> {
    return this.request<any>('POST', '/api/calls', callData);
  }

  async updateCall(id: string, callData: any): Promise<any> {
    return this.request<any>('PUT', `/api/calls/${id}`, callData);
  }

  // ===========================================
  // User API
  // ===========================================

  async getAllUsers(): Promise<any[]> {
    return this.request<any[]>('GET', '/api/users');
  }

  async getUser(id: string): Promise<any> {
    return this.request<any>('GET', `/api/users/${id}`);
  }

  async createUser(userData: any): Promise<any> {
    return this.request<any>('POST', '/api/users', userData);
  }

  async updateUser(id: string, userData: any): Promise<any> {
    return this.request<any>('PUT', `/api/users/${id}`, userData);
  }

  // ===========================================
  // Message API
  // ===========================================

  async getMessagesByContext(context: { taskId?: string; clientId?: string; callId?: string }): Promise<any[]> {
    const params = new URLSearchParams();
    if (context.taskId) params.append('taskId', context.taskId);
    if (context.clientId) params.append('clientId', context.clientId);
    if (context.callId) params.append('callId', context.callId);

    return this.request<any[]>('GET', `/api/messages?${params.toString()}`);
  }

  async createMessage(messageData: any): Promise<any> {
    return this.request<any>('POST', '/api/messages', messageData);
  }

  // ===========================================
  // Subtask API
  // ===========================================

  async getSubtasksByTaskId(taskId: string): Promise<any[]> {
    return this.request<any[]>('GET', `/api/subtasks?taskId=${taskId}`);
  }

  async createSubtask(subtaskData: any): Promise<any> {
    return this.request<any>('POST', '/api/subtasks', subtaskData);
  }

  async updateSubtask(id: string, subtaskData: any): Promise<any> {
    return this.request<any>('PUT', `/api/subtasks/${id}`, subtaskData);
  }

  async deleteSubtask(id: string): Promise<void> {
    await this.request<void>('DELETE', `/api/subtasks/${id}`);
  }

  // ===========================================
  // Settings API
  // ===========================================

  async getSetting(key: string): Promise<string | null> {
    const result = await this.request<{ value: string | null }>('GET', `/api/settings/${key}`);
    return result.value;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.request<void>('PUT', `/api/settings/${key}`, { value });
  }

  async getAllSettings(): Promise<Record<string, string>> {
    return this.request<Record<string, string>>('GET', '/api/settings');
  }
}
