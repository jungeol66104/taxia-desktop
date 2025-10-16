import express from 'express';
import localtunnel from 'localtunnel';
import { BrowserWindow } from 'electron';
import * as os from 'os';
import { WebhookServiceInterface, FileDetectionHandlerInterface, DatabaseServiceInterface } from './interfaces';
import { WebhookConfig } from '../../shared/types';
import { APP_CONSTANTS } from '../../shared/constants';
import { AuthUtils, JwtPayload } from '../utils/auth.utils';

export class ApiService implements WebhookServiceInterface {
  private app = express();
  private tunnel: any;
  private server: any;
  private mainWindow: BrowserWindow | null = null;
  private fileDetectionHandler: FileDetectionHandlerInterface | null = null;
  private config: WebhookConfig;
  private running = false;
  private googleDriveService: any = null; // Will be injected
  private databaseService: DatabaseServiceInterface | null = null; // Will be injected
  private lastWorkingTunnelUrl: string | null = null;
  private webhookRegistrationAttempts = 0;
  private maxWebhookRetries = 5;
  private actualPort: number = 3000;  // Auto-detected port
  private localIP: string = 'localhost';  // Auto-detected local IP

  constructor(mainWindow: BrowserWindow, config: WebhookConfig) {
    this.mainWindow = mainWindow;
    this.config = config;
    this.setupRoutes();
  }

  setDatabaseService(service: DatabaseServiceInterface): void {
    this.databaseService = service;
  }

  isRunning(): boolean {
    return this.running;
  }

  setFileDetectionHandler(handler: FileDetectionHandlerInterface): void {
    this.fileDetectionHandler = handler;
  }

  setGoogleDriveService(service: any): void {
    this.googleDriveService = service;
  }

  private setupRoutes(): void {
    this.app.use(express.json());
    this.app.use(express.raw({ type: 'application/json' }));

    // Logging middleware
    this.app.use((req, res, next) => {
      console.log(`📊 ${req.method} ${req.path} - ${new Date().toISOString()}`);
      console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));
      if (req.body && Object.keys(req.body).length > 0) {
        console.log('📦 Body:', JSON.stringify(req.body, null, 2));
      }
      next();
    });

    // Health check endpoint
    this.app.get('/', (req, res) => {
      console.log('🩺 Health check accessed');
      res.status(200).json({
        status: 'healthy',
        service: 'Taxia Webhook Service',
        timestamp: new Date().toISOString(),
        tunnelUrl: this.tunnel?.url || 'Not available',
        webhookUrl: this.getWebhookUrl() || 'Not available'
      });
    });

    // Manual testing endpoint
    this.app.post('/test-webhook', (req, res) => {
      console.log('🧪 SIMPLE TEST: Manual webhook test triggered');

      const testFileInfo = {
        fileName: req.body?.fileName || `simple_test_${Date.now()}.wav`,
        timestamp: new Date().toISOString(),
        resourceId: 'manual-test-resource',
        channelId: 'manual-test-channel',
        source: 'simple-manual-test'
      };

      console.log('🧪 SIMPLE TEST: Test file info:', testFileInfo);
      this.processFileDetection(testFileInfo);

      res.status(200).json({
        success: true,
        message: 'SIMPLE TEST: Manual webhook test completed',
        fileInfo: testFileInfo
      });
    });

    // Simple file test endpoint - simulate real file upload
    this.app.post('/test-simple-file', (req, res) => {
      console.log('🧪 SIMPLE TEST: Simulating real file upload to Google Drive folder');

      const testFileInfo = {
        fileName: req.body?.fileName || `real_test_${Date.now()}.wav`,
        timestamp: new Date().toISOString(),
        resourceId: '1msdV34TbxvukHC5mYJJq8JhS-gOSM3pc', // The actual watched folder ID
        channelId: 'test-channel',
        source: 'google-drive-webhook',
        needsFileIdResolution: true // This will trigger the real file lookup
      };

      console.log('🧪 SIMPLE TEST: Simulating folder change with file info:', testFileInfo);
      this.processFileDetection(testFileInfo);

      res.status(200).json({
        success: true,
        message: 'SIMPLE TEST: Simulated real file upload completed',
        fileInfo: testFileInfo,
        note: 'This will look for the latest audio file in the actual Google Drive folder'
      });
    });

    // Google Drive webhook endpoint
    this.app.post('/webhook', this.handleGoogleDriveWebhook.bind(this));

    // Health check endpoint for webhook URL
    this.app.get('/webhook', (req, res) => {
      console.log('🩺 Webhook health check accessed');
      res.status(200).json({
        status: 'healthy',
        endpoint: 'webhook',
        service: 'Taxia Google Drive Webhook',
        timestamp: new Date().toISOString(),
        message: 'Webhook endpoint is accessible and ready to receive Google Drive notifications'
      });
    });

    // ==========================================
    // API Endpoints for Client-Server Communication
    // ==========================================

    /**
     * POST /api/auth/login
     * Login endpoint for client mode
     *
     * Request body: { email: string, password: string }
     * Response: { success: true, token: string, user: {...} } or { success: false, message: string }
     */
    this.app.post('/api/auth/login', async (req, res) => {
      try {
        const { email, password } = req.body;

        console.log(`🔐 Login attempt: ${email}`);

        // Validate input
        if (!email || !password) {
          return res.status(400).json({
            success: false,
            message: 'Email and password are required'
          });
        }

        // Check if database service is available
        if (!this.databaseService) {
          console.error('❌ Database service not available');
          return res.status(500).json({
            success: false,
            message: 'Database service not available'
          });
        }

        // Find user by email (reusing DatabaseService)
        const users = await this.databaseService.getAllUsers();
        const user = users.find(u => u.email === email);

        if (!user) {
          console.log(`❌ User not found: ${email}`);
          return res.status(401).json({
            success: false,
            message: 'Invalid email or password'
          });
        }

        // Verify password (reusing AuthUtils)
        const isPasswordValid = await AuthUtils.verifyPassword(password, user.password);

        if (!isPasswordValid) {
          console.log(`❌ Invalid password for: ${email}`);
          return res.status(401).json({
            success: false,
            message: 'Invalid email or password'
          });
        }

        // Generate JWT token
        const token = AuthUtils.generateToken({
          userId: user.id,
          email: user.email,
          role: user.role
        });

        console.log(`✅ Login successful: ${email}`);

        // Return success with token
        res.status(200).json({
          success: true,
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar
          }
        });
      } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
          success: false,
          message: 'Internal server error'
        });
      }
    });

    /**
     * GET /api/auth/session
     * Validate session token
     *
     * Headers: Authorization: Bearer <token>
     * Response: { success: true, user: {...} } or { success: false, message: string }
     */
    this.app.get('/api/auth/session', async (req, res) => {
      try {
        // Extract token from Authorization header
        const token = AuthUtils.extractTokenFromHeader(req.headers.authorization);

        if (!token) {
          return res.status(401).json({
            success: false,
            message: 'No token provided'
          });
        }

        // Verify token
        const payload = AuthUtils.verifyToken(token);

        if (!payload) {
          return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
          });
        }

        console.log(`✅ Session validated for: ${payload.email}`);

        // Return user info from token
        res.status(200).json({
          success: true,
          user: {
            id: payload.userId,
            email: payload.email,
            role: payload.role
          }
        });
      } catch (error) {
        console.error('❌ Session validation error:', error);
        res.status(500).json({
          success: false,
          message: 'Internal server error'
        });
      }
    });

    // ==========================================
    // Clients API Endpoints
    // ==========================================

    /**
     * GET /api/clients
     * Get all clients
     */
    this.app.get('/api/clients', async (req, res) => {
      try {
        if (!this.databaseService) {
          return res.status(500).json({ success: false, message: 'Database service not available' });
        }

        const clients = await this.databaseService.getAllClients();
        res.status(200).json(clients);
      } catch (error) {
        console.error('❌ Get clients error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
      }
    });

    /**
     * POST /api/clients
     * Create a new client
     */
    this.app.post('/api/clients', async (req, res) => {
      try {
        if (!this.databaseService) {
          return res.status(500).json({ success: false, message: 'Database service not available' });
        }

        const newClient = await this.databaseService.createClient(req.body);
        res.status(201).json(newClient);
      } catch (error) {
        console.error('❌ Create client error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
      }
    });

    /**
     * PUT /api/clients/:id
     * Update a client
     */
    this.app.put('/api/clients/:id', async (req, res) => {
      try {
        if (!this.databaseService) {
          return res.status(500).json({ success: false, message: 'Database service not available' });
        }

        const updatedClient = await this.databaseService.updateClient(req.params.id, req.body);
        res.status(200).json(updatedClient);
      } catch (error) {
        console.error('❌ Update client error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
      }
    });

    /**
     * DELETE /api/clients/:id
     * Delete a client
     */
    this.app.delete('/api/clients/:id', async (req, res) => {
      try {
        if (!this.databaseService) {
          return res.status(500).json({ success: false, message: 'Database service not available' });
        }

        await this.databaseService.deleteClient(req.params.id);
        res.status(200).json({ success: true });
      } catch (error) {
        console.error('❌ Delete client error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
      }
    });

    // ==========================================
    // Tasks API Endpoints
    // ==========================================

    this.app.get('/api/tasks', async (req, res) => {
      try {
        if (!this.databaseService) {
          return res.status(500).json({ success: false, message: 'Database service not available' });
        }
        const tasks = await this.databaseService.getAllTasks();
        res.status(200).json(tasks);
      } catch (error) {
        console.error('❌ Get tasks error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
      }
    });

    this.app.post('/api/tasks', async (req, res) => {
      try {
        if (!this.databaseService) {
          return res.status(500).json({ success: false, message: 'Database service not available' });
        }
        const newTask = await this.databaseService.createTask(req.body);
        res.status(201).json(newTask);
      } catch (error) {
        console.error('❌ Create task error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
      }
    });

    this.app.put('/api/tasks/:id', async (req, res) => {
      try {
        if (!this.databaseService) {
          return res.status(500).json({ success: false, message: 'Database service not available' });
        }
        const updatedTask = await this.databaseService.updateTask(req.params.id, req.body);
        res.status(200).json(updatedTask);
      } catch (error) {
        console.error('❌ Update task error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
      }
    });

    this.app.delete('/api/tasks/:id', async (req, res) => {
      try {
        if (!this.databaseService) {
          return res.status(500).json({ success: false, message: 'Database service not available' });
        }
        await this.databaseService.deleteTask(req.params.id);
        res.status(200).json({ success: true });
      } catch (error) {
        console.error('❌ Delete task error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
      }
    });

    // ==========================================
    // Calls API Endpoints
    // ==========================================

    this.app.get('/api/calls', async (req, res) => {
      try {
        if (!this.databaseService) {
          return res.status(500).json({ success: false, message: 'Database service not available' });
        }
        const calls = await this.databaseService.getAllCalls();
        res.status(200).json(calls);
      } catch (error) {
        console.error('❌ Get calls error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
      }
    });

    this.app.post('/api/calls', async (req, res) => {
      try {
        if (!this.databaseService) {
          return res.status(500).json({ success: false, message: 'Database service not available' });
        }
        const newCall = await this.databaseService.createCall(req.body);
        res.status(201).json(newCall);
      } catch (error) {
        console.error('❌ Create call error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
      }
    });

    // ==========================================
    // Users API Endpoints
    // ==========================================

    this.app.get('/api/users', async (req, res) => {
      try {
        if (!this.databaseService) {
          return res.status(500).json({ success: false, message: 'Database service not available' });
        }
        const users = await this.databaseService.getAllUsers();
        res.status(200).json(users);
      } catch (error) {
        console.error('❌ Get users error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
      }
    });

    this.app.post('/api/users', async (req, res) => {
      try {
        if (!this.databaseService) {
          return res.status(500).json({ success: false, message: 'Database service not available' });
        }
        const newUser = await this.databaseService.createUser(req.body);
        res.status(201).json(newUser);
      } catch (error) {
        console.error('❌ Create user error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
      }
    });

    this.app.put('/api/users/:id', async (req, res) => {
      try {
        if (!this.databaseService) {
          return res.status(500).json({ success: false, message: 'Database service not available' });
        }
        const updatedUser = await this.databaseService.updateUser(req.params.id, req.body);
        res.status(200).json(updatedUser);
      } catch (error) {
        console.error('❌ Update user error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
      }
    });

    // ==========================================
    // Messages API Endpoints
    // ==========================================

    this.app.get('/api/messages', async (req, res) => {
      try {
        if (!this.databaseService) {
          return res.status(500).json({ success: false, message: 'Database service not available' });
        }
        const context = {
          taskId: req.query.taskId as string | undefined,
          clientId: req.query.clientId as string | undefined,
          callId: req.query.callId as string | undefined
        };
        const messages = await this.databaseService.getMessagesByContext(context);
        res.status(200).json(messages);
      } catch (error) {
        console.error('❌ Get messages error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
      }
    });

    this.app.post('/api/messages', async (req, res) => {
      try {
        if (!this.databaseService) {
          return res.status(500).json({ success: false, message: 'Database service not available' });
        }
        const newMessage = await this.databaseService.createMessage(req.body);
        res.status(201).json(newMessage);
      } catch (error) {
        console.error('❌ Create message error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
      }
    });

    // ==========================================
    // Subtasks API Endpoints
    // ==========================================

    this.app.get('/api/subtasks', async (req, res) => {
      try {
        if (!this.databaseService) {
          return res.status(500).json({ success: false, message: 'Database service not available' });
        }
        const taskId = req.query.taskId as string;
        if (!taskId) {
          return res.status(400).json({ success: false, message: 'taskId query parameter required' });
        }
        const subtasks = await this.databaseService.getSubtasksByTaskId(taskId);
        res.status(200).json(subtasks);
      } catch (error) {
        console.error('❌ Get subtasks error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
      }
    });

    this.app.post('/api/subtasks', async (req, res) => {
      try {
        if (!this.databaseService) {
          return res.status(500).json({ success: false, message: 'Database service not available' });
        }
        const newSubtask = await this.databaseService.createSubtask(req.body);
        res.status(201).json(newSubtask);
      } catch (error) {
        console.error('❌ Create subtask error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
      }
    });

    this.app.put('/api/subtasks/:id', async (req, res) => {
      try {
        if (!this.databaseService) {
          return res.status(500).json({ success: false, message: 'Database service not available' });
        }
        const updatedSubtask = await this.databaseService.updateSubtask(req.params.id, req.body);
        res.status(200).json(updatedSubtask);
      } catch (error) {
        console.error('❌ Update subtask error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
      }
    });

    this.app.delete('/api/subtasks/:id', async (req, res) => {
      try {
        if (!this.databaseService) {
          return res.status(500).json({ success: false, message: 'Database service not available' });
        }
        await this.databaseService.deleteSubtask(req.params.id);
        res.status(200).json({ success: true });
      } catch (error) {
        console.error('❌ Delete subtask error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
      }
    });

    // ==========================================
    // Settings API Endpoints
    // ==========================================

    this.app.get('/api/settings/:key', async (req, res) => {
      try {
        if (!this.databaseService) {
          return res.status(500).json({ success: false, message: 'Database service not available' });
        }
        const value = await this.databaseService.getSetting(req.params.key);
        res.status(200).json({ value });
      } catch (error) {
        console.error('❌ Get setting error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
      }
    });

    this.app.put('/api/settings/:key', async (req, res) => {
      try {
        if (!this.databaseService) {
          return res.status(500).json({ success: false, message: 'Database service not available' });
        }
        await this.databaseService.setSetting(req.params.key, req.body.value);
        res.status(200).json({ success: true });
      } catch (error) {
        console.error('❌ Set setting error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
      }
    });

    this.app.get('/api/settings', async (req, res) => {
      try {
        if (!this.databaseService) {
          return res.status(500).json({ success: false, message: 'Database service not available' });
        }
        const settings = await this.databaseService.getAllSettings();
        // Convert array to object
        const result: Record<string, string> = {};
        settings.forEach((s: any) => {
          result[s.key] = s.value;
        });
        res.status(200).json(result);
      } catch (error) {
        console.error('❌ Get all settings error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
      }
    });
  }

  private handleGoogleDriveWebhook(req: any, res: any): void {
    console.log('🔔 Google Drive Webhook received!');
    console.log('📊 Request details:');
    console.log('  - Resource State:', req.headers['x-goog-resource-state']);
    console.log('  - Changed:', req.headers['x-goog-changed']);
    console.log('  - Resource ID:', req.headers['x-goog-resource-id']);
    console.log('  - Channel ID:', req.headers['x-goog-channel-id']);
    console.log('  - Message Number:', req.headers['x-goog-message-number']);

    // Respond immediately to Google Drive
    res.status(200).send('OK');

    const resourceState = req.headers['x-goog-resource-state'];
    const changed = req.headers['x-goog-changed'];

    console.log(`🔍 Processing webhook: state=${resourceState}, changed=${changed}`);

    if (resourceState === 'update' && changed === 'children') {
      console.log('✅ File change detected - processing...');

      // Note: Google Drive webhooks for folder changes don't provide the specific file ID
      // We need to query the folder to find the latest file
      const folderResourceId = req.headers['x-goog-resource-id'];
      const fileName = req.body?.name || `call_recording_${Date.now()}.wav`;

      const fileInfo = {
        fileName: fileName,
        timestamp: new Date().toISOString(),
        resourceId: folderResourceId, // This is the folder ID, not file ID
        channelId: req.headers['x-goog-channel-id'],
        source: 'google-drive-webhook',
        needsFileIdResolution: true // Flag to indicate we need to resolve the actual file ID
      };

      console.log('📁 File info extracted (folder change detected):', fileInfo);
      this.processFileDetection(fileInfo);

    } else if (resourceState === 'sync') {
      console.log('📝 Sync notification (initial setup) - no action needed');
    } else {
      console.log(`⚠️  Unhandled webhook: state=${resourceState}, changed=${changed}`);
    }
  }

  private processFileDetection(fileInfo: any): void {
    // Send to UI immediately via IPC
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      console.log('📤 Sending file-detected event to renderer');
      this.mainWindow.webContents.send(APP_CONSTANTS.IPC_CHANNELS.FILE_DETECTED, fileInfo);
    } else {
      console.log('❌ MainWindow not available for IPC');
    }

    // Process file directly via handler
    if (this.fileDetectionHandler) {
      console.log('🔄 Processing via file detection handler');
      this.fileDetectionHandler.handleFileDetected(fileInfo);
    } else {
      console.log('❌ File detection handler not available');
    }
  }

  async start(): Promise<void> {
    try {
      // Auto-detect available port
      this.actualPort = await this.findAvailablePort();

      // Start Express server
      this.server = this.app.listen(this.actualPort, () => {
        console.log(`🚀 API Server started on port ${this.actualPort}`);
      });

      // Detect local IP
      this.localIP = this.getLocalIP();
      console.log(`🌐 Local Network URL: http://${this.localIP}:${this.actualPort}`);

      // Create LocalTunnel for public URL with improved stability (if enabled)
      if (this.config.enableRemoteAccess) {
        await this.createTunnelWithRetry();
      }

      this.running = true;
    } catch (error) {
      console.error('❌ Failed to start API server:', error);
      throw error;
    }
  }

  /**
   * Find an available port - try 3000 first, then let OS choose
   */
  private async findAvailablePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      // Try port 3000 first
      const testServer = this.app.listen(3000, () => {
        const address = testServer.address();
        if (!address || typeof address === 'string') {
          testServer.close();
          reject(new Error('Failed to get server address'));
          return;
        }
        const port = address.port;
        testServer.close();
        console.log(`✅ Port 3000 is available`);
        resolve(3000);
      });

      testServer.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`⚠️  Port 3000 is in use, finding alternative...`);
          // Let OS assign available port
          const fallbackServer = this.app.listen(0, () => {
            const address = fallbackServer.address();
            if (!address || typeof address === 'string') {
              fallbackServer.close();
              reject(new Error('Failed to get fallback server address'));
              return;
            }
            const port = address.port;
            fallbackServer.close();
            console.log(`✅ Using port ${port}`);
            resolve(port);
          });

          fallbackServer.on('error', reject);
        } else {
          reject(err);
        }
      });
    });
  }

  /**
   * Get local network IP address
   */
  private getLocalIP(): string {
    const interfaces = os.networkInterfaces();

    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name];
      if (!iface) continue;

      for (const alias of iface) {
        // IPv4, not internal (localhost), not virtual
        if (alias.family === 'IPv4' && !alias.internal && !name.toLowerCase().includes('virtual')) {
          return alias.address;
        }
      }
    }

    return 'localhost';
  }

  /**
   * Get the local URL for same-network connections
   */
  getLocalUrl(): string {
    return `http://${this.localIP}:${this.actualPort}`;
  }

  /**
   * Get the current port
   */
  getPort(): number {
    return this.actualPort;
  }

  private async createTunnelWithRetry(retries = 3): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`🔗 Creating LocalTunnel (attempt ${attempt}/${retries})...`);

        this.tunnel = await localtunnel({
          port: this.actualPort,
          subdomain: this.config.subdomain ||
            APP_CONSTANTS.WEBHOOK.TUNNEL_PREFIX + Math.random().toString(36).substr(2, 9),
          local_host: this.config.localHost
        });

        console.log('🌐 LocalTunnel URL:', this.tunnel.url);

        // Simple event handlers without complex reconnection logic
        this.tunnel.on('close', () => {
          console.log('⚠️  Tunnel closed - will retry on next webhook registration');
        });

        this.tunnel.on('error', (err: any) => {
          console.warn('⚠️  Tunnel error (non-fatal):', err.message);
        });

        // Test tunnel connectivity
        await this.testTunnelConnectivity();

        // Store as last working URL
        this.lastWorkingTunnelUrl = this.tunnel.url;

        // Re-register Google Drive webhook with new URL (delayed for stability)
        setTimeout(async () => {
          try {
            await this.reregisterGoogleDriveWebhook();
            console.log('✅ Webhook registered with stable tunnel');
          } catch (error) {
            console.error('❌ Failed to register webhook after tunnel creation:', error);
          }
        }, 2000); // 2 second delay to ensure tunnel is stable

        console.log('✅ LocalTunnel created and tested successfully');
        return;

      } catch (error) {
        console.error(`❌ Tunnel creation attempt ${attempt} failed:`, error);
        if (attempt === retries) {
          throw new Error(`Failed to create tunnel after ${retries} attempts: ${error}`);
        }
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

  // Simplified approach: avoid complex reconnection logic that caused multiple concurrent tunnels
  // Key improvement: delayed webhook registration + exponential backoff on creation failure

  private async testTunnelConnectivity(): Promise<void> {
    try {
      if (!this.tunnel?.url) {
        throw new Error('No tunnel URL available');
      }

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(this.tunnel.url, {
        signal: controller.signal,
        method: 'GET'
      });

      clearTimeout(timeoutId);

      if (response.status === 200) {
        console.log('✅ Tunnel connectivity test passed');
      } else {
        console.warn(`⚠️  Tunnel test returned status: ${response.status}`);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn('⚠️  Tunnel connectivity test timed out (5s) - continuing anyway');
      } else {
        console.warn('⚠️  Tunnel connectivity test failed:', error.message);
      }
      // Don't throw - let it continue and retry later
    }
  }

  private async reregisterGoogleDriveWebhook(): Promise<void> {
    this.webhookRegistrationAttempts++;

    try {
      if (!this.googleDriveService) {
        console.log('ℹ️  Google Drive service not available for webhook re-registration');
        return;
      }

      if (!this.tunnel?.url) {
        console.warn('⚠️  No tunnel URL available for webhook registration');
        return;
      }

      console.log(`🔄 Re-registering Google Drive webhook (attempt ${this.webhookRegistrationAttempts}/${this.maxWebhookRetries}) with new tunnel URL:`, this.tunnel.url);

      // Call the existing restartWebhook method in GoogleDriveService
      await this.googleDriveService.restartWebhook();

      // Reset retry counter on success
      this.webhookRegistrationAttempts = 0;

      // Notify UI of successful webhook registration
      this.notifyWebhookStatus('registered', {
        webhookUrl: this.getWebhookUrl(),
        tunnelUrl: this.tunnel.url,
        timestamp: new Date().toISOString()
      });

      console.log('✅ Google Drive webhook re-registered successfully');
    } catch (error) {
      console.error(`❌ Failed to re-register Google Drive webhook (attempt ${this.webhookRegistrationAttempts}/${this.maxWebhookRetries}):`, error);

      // Retry with exponential backoff if under max retries
      if (this.webhookRegistrationAttempts < this.maxWebhookRetries) {
        const retryDelay = Math.min(1000 * Math.pow(2, this.webhookRegistrationAttempts), 30000); // Max 30s
        console.log(`⏰ Retrying webhook registration in ${retryDelay}ms...`);

        setTimeout(async () => {
          await this.reregisterGoogleDriveWebhook();
        }, retryDelay);
      } else {
        // Max retries reached - notify UI of failure
        this.webhookRegistrationAttempts = 0; // Reset for next tunnel
        this.notifyWebhookStatus('failed', {
          error: error.message,
          tunnelUrl: this.tunnel?.url,
          timestamp: new Date().toISOString(),
          maxRetriesReached: true
        });
      }
    }
  }

  private notifyWebhookStatus(status: 'registered' | 'failed', data: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(APP_CONSTANTS.IPC_CHANNELS.WEBHOOK_STATUS_CHANGED, {
        status,
        ...data
      });
    }
  }

  async stop(): Promise<void> {
    if (this.tunnel) {
      this.tunnel.close();
      this.tunnel = null;
    }
    if (this.server) {
      this.server.close();
    }
    this.running = false;
  }

  async ensureTunnel(): Promise<string> {
    // If tunnel already exists, return its URL
    if (this.tunnel) {
      return this.tunnel.url + '/webhook';
    }

    // Create tunnel if it doesn't exist
    console.log('🔗 Creating tunnel for Google Drive webhooks (HTTPS required)...');
    await this.createTunnelWithRetry();

    if (!this.tunnel) {
      throw new Error('Failed to create tunnel for Google Drive webhooks');
    }

    return this.tunnel.url + '/webhook';
  }

  getWebhookUrl(): string | null {
    // Return tunnel URL if available (for remote access)
    if (this.tunnel) {
      return this.tunnel.url + '/webhook';
    }

    // Return local network URL if service is running (for local/LAN access)
    if (this.running) {
      return `http://${this.localIP}:${this.actualPort}/webhook`;
    }

    return null;
  }
}