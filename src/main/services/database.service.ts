import { randomBytes } from 'crypto';
import { app } from 'electron';
import * as path from 'path';
import { BaseService } from './interfaces';
import { Client, Call, Task } from '../../shared/types';
import { safeAsync, createError, safeJSONParse } from '../../shared/utils';

// Simple Prisma import - works for both dev and production
// Using createRequire because Vite uses ESM but Prisma needs CommonJS
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

function getPrismaClient() {
  console.log('🔧 [DB] Loading Prisma Client...');
  try {
    const { PrismaClient } = require('@prisma/client');
    console.log('✅ [DB] Prisma Client loaded successfully');
    return PrismaClient;
  } catch (error) {
    console.error('❌ [DB] Failed to load Prisma Client');
    console.error('❌ [DB] Error:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export class DatabaseService implements BaseService {
  private prisma: any;
  private running = false;

  constructor() {
    // Prisma will be initialized in start()
  }

  async start(): Promise<void> {
    console.log('🔧 [DB] DatabaseService.start() called');
    try {
      // Initialize Prisma Client
      if (!this.prisma) {
        console.log('🔧 [DB] Prisma client not initialized, creating new instance...');
        const PrismaClientClass = getPrismaClient();

        // Set database path to user data directory (works for both dev and production)
        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'taxia.db');
        const dbUrl = `file:${dbPath}`;

        console.log('🔧 [DB] Database URL:', dbUrl);
        console.log('🔧 [DB] User data path:', userDataPath);

        // Check if database file exists
        const fs = await import('fs');
        const dbExists = fs.existsSync(dbPath);
        console.log('🔧 [DB] Database file exists:', dbExists);

        // Initialize Prisma with custom datasource URL (same for dev and production)
        this.prisma = new PrismaClientClass({
          datasources: {
            db: { url: dbUrl }
          }
        });
        console.log('✅ [DB] Prisma Client instance created');
      } else {
        console.log('🔧 [DB] Prisma client already initialized, reusing');
      }

      console.log('🔧 [DB] Connecting to database...');
      await this.prisma.$connect();
      console.log('✅ [DB] Prisma connected successfully');

      // Ensure database schema exists - use raw SQL to create tables if they don't exist
      // This is safer than migrations in packaged apps
      console.log('🔧 [DB] Ensuring database schema...');
      await this.ensureSchema();
      console.log('✅ [DB] Database schema verified/created');

      this.running = true;
      console.log('✅ [DB] Database service started successfully');

      // Auto-generate JWT secret on first startup
      console.log('🔧 [DB] Ensuring JWT secret...');
      await this.ensureJwtSecret();
      console.log('✅ [DB] JWT secret verified/created');
    } catch (error) {
      console.error('❌ [DB] Failed to start database service');
      console.error('❌ [DB] Error type:', error?.constructor?.name);
      console.error('❌ [DB] Error message:', error instanceof Error ? error.message : String(error));
      console.error('❌ [DB] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('❌ [DB] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      throw createError('Database connection failed', error);
    }
  }

  /**
   * Ensure database schema exists
   * Creates tables if they don't exist using raw SQL
   */
  private async ensureSchema(): Promise<void> {
    try {
      // Try to query the AppSettings table - if it succeeds, schema exists
      await this.prisma.$queryRaw`SELECT 1 FROM AppSettings LIMIT 1`;
      console.log('✅ Database schema already exists');
    } catch (error) {
      console.log('🔧 Database schema does not exist, creating tables...');

      // Create all tables using raw SQL based on schema.prisma
      try {
        // Create User table
        await this.prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS "User" (
            "id" TEXT PRIMARY KEY NOT NULL,
            "name" TEXT NOT NULL,
            "email" TEXT NOT NULL UNIQUE,
            "password" TEXT NOT NULL,
            "role" TEXT NOT NULL,
            "avatar" TEXT,
            "tpCode" TEXT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `;
        console.log('  ✓ User table created');

        // Create Client table
        await this.prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS "Client" (
            "id" TEXT PRIMARY KEY NOT NULL,
            "companyName" TEXT NOT NULL,
            "representative" TEXT NOT NULL,
            "businessRegistrationNumber" TEXT NOT NULL,
            "contactNumber" TEXT NOT NULL,
            "email" TEXT NOT NULL,
            "address" TEXT NOT NULL,
            "assignee" TEXT NOT NULL,
            "contractDate" TEXT NOT NULL,
            "status" TEXT NOT NULL DEFAULT 'active',
            "notes" TEXT,
            "tpCode" TEXT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `;
        console.log('  ✓ Client table created');

        // Create Call table
        await this.prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS "Call" (
            "id" TEXT PRIMARY KEY NOT NULL,
            "clientId" TEXT,
            "userId" TEXT,
            "date" TEXT NOT NULL,
            "callerName" TEXT NOT NULL,
            "phoneNumber" TEXT NOT NULL,
            "recordingFileName" TEXT NOT NULL,
            "callDuration" TEXT NOT NULL,
            "transcript" TEXT,
            "fileExists" INTEGER NOT NULL DEFAULT 1,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE,
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
          )
        `;
        console.log('  ✓ Call table created');

        // Create Task table
        await this.prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS "Task" (
            "id" TEXT PRIMARY KEY NOT NULL,
            "callId" TEXT,
            "clientId" TEXT,
            "title" TEXT NOT NULL,
            "assignee" TEXT NOT NULL,
            "status" TEXT NOT NULL DEFAULT 'pending',
            "startDate" TEXT NOT NULL,
            "dueDate" TEXT NOT NULL,
            "progress" INTEGER NOT NULL DEFAULT 0,
            "category" TEXT NOT NULL,
            "tags" TEXT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE SET NULL ON UPDATE CASCADE,
            FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE
          )
        `;
        console.log('  ✓ Task table created');

        // Create Subtask table
        await this.prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS "Subtask" (
            "id" TEXT PRIMARY KEY NOT NULL,
            "taskId" TEXT NOT NULL,
            "title" TEXT NOT NULL,
            "assignee" TEXT,
            "status" TEXT NOT NULL DEFAULT 'pending',
            "dueDate" TEXT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE
          )
        `;
        console.log('  ✓ Subtask table created');

        // Create Message table
        await this.prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS "Message" (
            "id" TEXT PRIMARY KEY NOT NULL,
            "userId" TEXT NOT NULL,
            "content" TEXT NOT NULL,
            "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "metadata" TEXT,
            "taskId" TEXT,
            "clientId" TEXT,
            "callId" TEXT,
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
            FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE ON UPDATE CASCADE
          )
        `;
        console.log('  ✓ Message table created');

        // Create AppSettings table
        await this.prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS "AppSettings" (
            "id" TEXT PRIMARY KEY NOT NULL,
            "key" TEXT NOT NULL UNIQUE,
            "value" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `;
        console.log('  ✓ AppSettings table created');

        console.log('✅ Database schema created successfully');
      } catch (createError) {
        console.error('❌ Failed to create database schema:', createError);
        throw createError;
      }
    }
  }

  /**
   * Ensure JWT secret exists in database
   * Generates a random secret on first startup
   */
  private async ensureJwtSecret(): Promise<void> {
    const existingSecret = await this.getSetting('jwt_secret');

    if (!existingSecret) {
      // Generate a cryptographically secure random secret (64 bytes = 128 hex chars)
      const newSecret = randomBytes(64).toString('hex');
      await this.setSetting('jwt_secret', newSecret);
      console.log('🔐 JWT secret auto-generated and stored in database');
    } else {
      console.log('🔐 JWT secret loaded from database');
    }
  }

  async stop(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      this.running = false;
      console.log('✅ Database service stopped');
    } catch (error) {
      console.error('❌ Error stopping database service:', error);
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  // Client operations
  async getAllClients(): Promise<Client[]> {
    const result = await safeAsync(
      () => this.prisma.client.findMany({
        orderBy: { createdAt: 'desc' }
      }),
      'Failed to fetch clients'
    );

    if (!result) throw createError('Failed to fetch clients');

    // Convert Prisma result to our Client interface
    return result.map(client => ({
      id: client.id,
      companyName: client.companyName,
      representative: client.representative,
      businessRegistrationNumber: client.businessRegistrationNumber,
      contactNumber: client.contactNumber,
      email: client.email,
      address: client.address,
      assignee: client.assignee,
      contractDate: client.contractDate,
      status: client.status as Client['status'],
      notes: client.notes || undefined
    }));
  }

  async createClient(clientData: Omit<Client, 'id'>): Promise<Client> {
    const result = await safeAsync(
      () => this.prisma.client.create({
        data: {
          companyName: clientData.companyName,
          representative: clientData.representative,
          businessRegistrationNumber: clientData.businessRegistrationNumber,
          contactNumber: clientData.contactNumber,
          email: clientData.email,
          address: clientData.address,
          assignee: clientData.assignee,
          contractDate: clientData.contractDate,
          status: clientData.status,
          notes: clientData.notes
        }
      }),
      'Failed to create client'
    );

    if (!result) throw createError('Failed to create client');

    return {
      id: result.id,
      companyName: result.companyName,
      representative: result.representative,
      businessRegistrationNumber: result.businessRegistrationNumber,
      contactNumber: result.contactNumber,
      email: result.email,
      address: result.address,
      assignee: result.assignee,
      contractDate: result.contractDate,
      status: result.status as Client['status'],
      notes: result.notes || undefined
    };
  }

  async updateClient(clientId: string, clientData: Partial<Omit<Client, 'id'>>): Promise<Client> {
    const result = await safeAsync(
      () => this.prisma.client.update({
        where: { id: clientId },
        data: {
          ...(clientData.companyName !== undefined && { companyName: clientData.companyName }),
          ...(clientData.representative !== undefined && { representative: clientData.representative }),
          ...(clientData.businessRegistrationNumber !== undefined && { businessRegistrationNumber: clientData.businessRegistrationNumber }),
          ...(clientData.contactNumber !== undefined && { contactNumber: clientData.contactNumber }),
          ...(clientData.email !== undefined && { email: clientData.email }),
          ...(clientData.address !== undefined && { address: clientData.address }),
          ...(clientData.assignee !== undefined && { assignee: clientData.assignee }),
          ...(clientData.contractDate !== undefined && { contractDate: clientData.contractDate }),
          ...(clientData.status !== undefined && { status: clientData.status }),
          ...(clientData.notes !== undefined && { notes: clientData.notes })
        }
      }),
      'Failed to update client'
    );

    if (!result) throw createError('Failed to update client');

    return {
      id: result.id,
      companyName: result.companyName,
      representative: result.representative,
      businessRegistrationNumber: result.businessRegistrationNumber,
      contactNumber: result.contactNumber,
      email: result.email,
      address: result.address,
      assignee: result.assignee,
      contractDate: result.contractDate,
      status: result.status as Client['status'],
      notes: result.notes || undefined
    };
  }

  // Call operations
  async getAllCalls(): Promise<Call[]> {
    const result = await safeAsync(
      () => this.prisma.call.findMany({
        include: { client: true },
        orderBy: { createdAt: 'desc' }
      }),
      'Failed to fetch calls'
    );

    if (!result) throw createError('Failed to fetch calls');

    return result.map(call => ({
      id: call.id,
      date: call.date,
      callerName: call.callerName,
      clientName: call.client?.companyName || null,
      phoneNumber: call.phoneNumber,
      recordingFileName: call.recordingFileName,
      transcriptFileName: call.transcriptFileName || '',
      callDuration: call.callDuration,
      transcript: call.transcript
    }));
  }

  async createCall(callData: Omit<Call, 'id'> & { clientId?: string; userId?: string; transcript?: string }): Promise<Call> {
    const result = await safeAsync(
      () => this.prisma.call.create({
        data: {
          clientId: callData.clientId,
          userId: callData.userId,
          date: callData.date,
          callerName: callData.callerName,
          phoneNumber: callData.phoneNumber,
          recordingFileName: callData.recordingFileName,
          callDuration: callData.callDuration,
          transcript: callData.transcript
        },
        include: { client: true }
      }),
      'Failed to create call'
    );

    if (!result) throw createError('Failed to create call');

    return {
      id: result.id,
      date: result.date,
      callerName: result.callerName,
      clientName: result.client?.companyName || null,
      phoneNumber: result.phoneNumber,
      recordingFileName: result.recordingFileName,
      transcriptFileName: '', // Removed field
      callDuration: result.callDuration,
      transcript: result.transcript
    };
  }

  async updateCallTranscript(callId: string, transcript: string): Promise<void> {
    const result = await safeAsync(
      () => this.prisma.call.update({
        where: { id: callId },
        data: { transcript: transcript }
      }),
      'Failed to update call transcript'
    );

    if (!result) {
      throw createError('Failed to update call transcript', { callId, transcript });
    }

    console.log(`✅ Updated transcript for call ${callId}`);
  }

  async findClientByName(companyName: string): Promise<Client | null> {
    const result = await safeAsync(
      () => this.prisma.client.findFirst({
        where: { companyName: { contains: companyName } }
      }),
      'Failed to find client'
    );

    if (!result) return null;

    return {
      id: result.id,
      companyName: result.companyName,
      representative: result.representative,
      businessRegistrationNumber: result.businessRegistrationNumber,
      contactNumber: result.contactNumber,
      email: result.email,
      address: result.address,
      assignee: result.assignee,
      contractDate: result.contractDate,
      status: result.status as Client['status'],
      notes: result.notes || undefined
    };
  }

  // Task operations
  async getAllTasks(): Promise<Task[]> {
    console.log('🔧 DATABASE: getAllTasks() called');

    const result = await safeAsync(
      () => this.prisma.task.findMany({
        include: { client: true, call: true },
        orderBy: { createdAt: 'desc' }
      }),
      'Failed to fetch tasks'
    );

    console.log('🔧 DATABASE: Raw Prisma getAllTasks result:', result);

    if (!result) throw createError('Failed to fetch tasks');

    const mappedTasks = result.map(task => ({
      id: task.id,
      title: task.title,
      clientName: task.client?.companyName || '',
      clientId: task.clientId || undefined,
      assignee: task.assignee,
      status: task.status as Task['status'],
      startDate: task.startDate,
      dueDate: task.dueDate,
      createdAt: task.createdAt.toISOString(),
      progress: task.progress,
      category: task.category,
      tags: task.tags ? safeJSONParse<string[]>(task.tags, []) : undefined
    }));

    console.log('🔧 DATABASE: Mapped tasks being returned:', mappedTasks);
    return mappedTasks;
  }

  async createTask(taskData: Omit<Task, 'id' | 'createdAt'> & { callId?: string; clientId?: string }): Promise<Task> {
    const result = await safeAsync(
      () => this.prisma.task.create({
        data: {
          callId: taskData.callId,
          clientId: taskData.clientId,
          title: taskData.title,
          assignee: taskData.assignee,
          status: taskData.status,
          startDate: taskData.startDate,
          dueDate: taskData.dueDate,
          progress: taskData.progress,
          category: taskData.category,
          tags: taskData.tags ? JSON.stringify(taskData.tags) : null
        },
        include: { client: true, call: true }
      }),
      'Failed to create task'
    );

    if (!result) throw createError('Failed to create task');

    return {
      id: result.id,
      title: result.title,
      clientName: result.client?.companyName || '',
      clientId: result.clientId || undefined,
      assignee: result.assignee,
      status: result.status as Task['status'],
      startDate: result.startDate,
      dueDate: result.dueDate,
      createdAt: result.createdAt.toISOString(),
      progress: result.progress,
      category: result.category,
      tags: result.tags ? safeJSONParse<string[]>(result.tags, []) : undefined
    };
  }

  async updateTask(taskId: string, taskData: Partial<Omit<Task, 'id' | 'createdAt'>> & { clientId?: string }): Promise<Task> {
    console.log('🔧 DATABASE: updateTask called with:', { taskId, taskData });

    // If clientId is being updated, verify the client exists
    if (taskData.clientId !== undefined) {
      const clientExists = await this.prisma.client.findUnique({
        where: { id: taskData.clientId }
      });
      console.log('🔧 DATABASE: Client lookup for ID', taskData.clientId, ':', clientExists);
      if (!clientExists) {
        console.error('🚨 DATABASE: Client with ID', taskData.clientId, 'does not exist');
        throw createError(`Client with ID ${taskData.clientId} does not exist`);
      }
    }

    const updateData = {
      ...(taskData.title !== undefined && { title: taskData.title }),
      ...(taskData.assignee !== undefined && { assignee: taskData.assignee }),
      ...(taskData.status !== undefined && { status: taskData.status }),
      ...(taskData.startDate !== undefined && { startDate: taskData.startDate }),
      ...(taskData.dueDate !== undefined && { dueDate: taskData.dueDate }),
      ...(taskData.progress !== undefined && { progress: taskData.progress }),
      ...(taskData.category !== undefined && { category: taskData.category }),
      ...(taskData.tags !== undefined && { tags: taskData.tags ? JSON.stringify(taskData.tags) : null }),
      ...(taskData.clientId !== undefined && { clientId: taskData.clientId })
    };

    console.log('🔧 DATABASE: Update data being sent to Prisma:', updateData);

    const result = await safeAsync(
      () => this.prisma.task.update({
        where: { id: taskId },
        data: updateData,
        include: { client: true, call: true }
      }),
      'Failed to update task'
    );

    console.log('🔧 DATABASE: Raw Prisma result:', result);

    if (!result) throw createError('Failed to update task');

    return {
      id: result.id,
      title: result.title,
      clientName: result.client?.companyName || '',
      clientId: result.clientId || undefined,
      assignee: result.assignee,
      status: result.status as Task['status'],
      startDate: result.startDate,
      dueDate: result.dueDate,
      createdAt: result.createdAt.toISOString(),
      progress: result.progress,
      category: result.category,
      tags: result.tags ? safeJSONParse<string[]>(result.tags, []) : undefined
    };
  }

  async createTasksFromCall(callId: string, tasks: Omit<Task, 'id' | 'createdAt'>[]): Promise<Task[]> {
    const results = await Promise.all(
      tasks.map(task => this.createTask({ ...task, callId }))
    );
    return results;
  }

  // User operations
  async getAllUsers(): Promise<any[]> {
    const result = await safeAsync(
      () => this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' }
      }),
      'Failed to fetch users'
    );

    if (!result) throw createError('Failed to fetch users');
    return result;
  }

  async getAllHumanUsers(): Promise<any[]> {
    const result = await safeAsync(
      () => this.prisma.user.findMany({
        where: { role: { not: 'taxia' } },
        orderBy: { createdAt: 'desc' }
      }),
      'Failed to fetch human users'
    );

    if (!result) throw createError('Failed to fetch human users');
    return result;
  }

  async createUser(userData: { name: string; email: string; password: string; role: string; avatar?: string }): Promise<any> {
    const result = await safeAsync(
      () => this.prisma.user.create({
        data: userData
      }),
      'Failed to create user'
    );

    if (!result) throw createError('Failed to create user');
    return result;
  }

  async getUserByRole(role: string): Promise<any | null> {
    const result = await safeAsync(
      () => this.prisma.user.findFirst({
        where: { role }
      }),
      'Failed to find user by role'
    );

    return result || null;
  }

  async updateUser(userId: string, userData: Partial<{ name: string; email: string; role: string; avatar?: string }>): Promise<any> {
    const result = await safeAsync(
      () => this.prisma.user.update({
        where: { id: userId },
        data: {
          ...userData,
          updatedAt: new Date()
        }
      }),
      'Failed to update user'
    );

    if (!result) throw createError('Failed to update user');
    return result;
  }

  async getUserByEmail(email: string): Promise<any | null> {
    const result = await safeAsync(
      () => this.prisma.user.findUnique({
        where: { email }
      }),
      'Failed to find user by email'
    );

    return result || null;
  }

  async getUserByName(name: string): Promise<any | null> {
    const result = await safeAsync(
      () => this.prisma.user.findFirst({
        where: { name }
      }),
      'Failed to find user by name'
    );

    return result || null;
  }

  // Subtask operations
  async getSubtasksByTaskId(taskId: string): Promise<any[]> {
    const result = await safeAsync(
      () => this.prisma.subtask.findMany({
        where: { taskId },
        orderBy: { createdAt: 'desc' }
      }),
      'Failed to fetch subtasks'
    );

    if (!result) throw createError('Failed to fetch subtasks');
    return result;
  }

  async createSubtask(subtaskData: { taskId: string; title: string; assignee?: string; status?: string; dueDate?: string }): Promise<any> {
    const result = await safeAsync(
      () => this.prisma.subtask.create({
        data: subtaskData
      }),
      'Failed to create subtask'
    );

    if (!result) throw createError('Failed to create subtask');
    return result;
  }

  async updateSubtask(subtaskId: string, subtaskData: Partial<{ title: string; assignee?: string; status?: string; dueDate?: string }>): Promise<any> {
    const result = await safeAsync(
      () => this.prisma.subtask.update({
        where: { id: subtaskId },
        data: {
          ...(subtaskData.title !== undefined && { title: subtaskData.title }),
          ...(subtaskData.assignee !== undefined && { assignee: subtaskData.assignee }),
          ...(subtaskData.status !== undefined && { status: subtaskData.status }),
          ...(subtaskData.dueDate !== undefined && { dueDate: subtaskData.dueDate })
        }
      }),
      'Failed to update subtask'
    );

    if (!result) throw createError('Failed to update subtask');
    return result;
  }

  // Message operations
  async getMessagesByContext(context: { taskId?: string; clientId?: string; callId?: string }): Promise<any[]> {
    const result = await safeAsync(
      () => this.prisma.message.findMany({
        where: context,
        include: { user: true },
        orderBy: { timestamp: 'asc' }
      }),
      'Failed to fetch messages'
    );

    if (!result) throw createError('Failed to fetch messages');
    return result;
  }

  async createMessage(messageData: {
    userId: string;
    content: string;
    taskId?: string;
    clientId?: string;
    callId?: string;
    metadata?: string;
  }): Promise<any> {
    const result = await safeAsync(
      () => this.prisma.message.create({
        data: messageData,
        include: { user: true }
      }),
      'Failed to create message'
    );

    if (!result) throw createError('Failed to create message');
    return result;
  }

  // Delete operations
  async deleteClient(clientId: string): Promise<void> {
    const result = await safeAsync(
      async () => {
        // Use transaction to ensure data consistency
        return await this.prisma.$transaction(async (tx) => {
          // First delete all related records (messages have cascade, but calls and tasks don't)
          await tx.task.deleteMany({
            where: { clientId: clientId }
          });

          await tx.call.updateMany({
            where: { clientId: clientId },
            data: { clientId: null } // Set to null instead of deleting calls
          });

          // Finally delete the client
          return await tx.client.delete({
            where: { id: clientId }
          });
        });
      },
      'Failed to delete client'
    );

    if (!result) throw createError('Failed to delete client');
  }

  async deleteTask(taskId: string): Promise<void> {
    const result = await safeAsync(
      async () => {
        // Use transaction to ensure data consistency
        return await this.prisma.$transaction(async (tx) => {
          // Delete subtasks first (they have onDelete: Cascade, but let's be explicit)
          await tx.subtask.deleteMany({
            where: { taskId: taskId }
          });

          // Messages have onDelete: Cascade, so they'll be deleted automatically
          // Finally delete the task
          return await tx.task.delete({
            where: { id: taskId }
          });
        });
      },
      'Failed to delete task'
    );

    if (!result) throw createError('Failed to delete task');
  }

  async deleteSubtask(subtaskId: string): Promise<void> {
    const result = await safeAsync(
      () => this.prisma.subtask.delete({
        where: { id: subtaskId }
      }),
      'Failed to delete subtask'
    );

    if (!result) throw createError('Failed to delete subtask');
  }

  // App Settings operations
  async getSetting(key: string): Promise<string | null> {
    const result = await safeAsync(
      () => this.prisma.appSettings.findUnique({
        where: { key }
      }),
      `Failed to fetch setting: ${key}`
    );

    return result?.value || null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await safeAsync(
      () => this.prisma.appSettings.upsert({
        where: { key },
        update: { value },
        create: { key, value }
      }),
      `Failed to set setting: ${key}`
    );
  }

  async getAllSettings(): Promise<Record<string, string>> {
    const result = await safeAsync(
      () => this.prisma.appSettings.findMany(),
      'Failed to fetch all settings'
    );

    if (!result) return {};

    return result.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>);
  }

  // Factory reset - delete all data
  async deleteAllData(): Promise<void> {
    console.log('🗑️ Starting factory reset - deleting all data...');

    try {
      // Delete in order (respecting foreign key constraints)
      await this.prisma.message.deleteMany();
      console.log('  ✓ Messages deleted');

      await this.prisma.subtask.deleteMany();
      console.log('  ✓ Subtasks deleted');

      await this.prisma.task.deleteMany();
      console.log('  ✓ Tasks deleted');

      await this.prisma.call.deleteMany();
      console.log('  ✓ Calls deleted');

      await this.prisma.client.deleteMany();
      console.log('  ✓ Clients deleted');

      await this.prisma.user.deleteMany();
      console.log('  ✓ Users deleted');

      await this.prisma.appSettings.deleteMany();
      console.log('  ✓ App settings deleted');

      console.log('✅ Factory reset complete - all data deleted');
    } catch (error) {
      console.error('❌ Factory reset failed:', error);
      throw createError('Factory reset failed', error);
    }
  }

  // Seed database with mock data for development
  async seedMockData(): Promise<void> {
    console.log('🌱 Seeding database with mock data...');

    // Check if data already exists
    const existingUsers = await this.prisma.user.count();
    if (existingUsers > 0) {
      console.log('📊 Database already has data, skipping seed');
      return;
    }

    // Create default Taxia user
    const taxiaUser = await this.prisma.user.create({
      data: {
        name: 'Taxia',
        email: 'taxia@system.local',
        role: 'taxia'
      }
    });

    // Create default admin user
    await this.prisma.user.create({
      data: {
        name: 'Admin',
        email: 'admin@taxia.local',
        role: 'admin'
      }
    });

    // Create mock clients
    const mockClients = [
      {
        companyName: '테스트 주식회사',
        representative: 'Kim Test-soo',
        businessRegistrationNumber: '123-45-67890',
        contactNumber: '02-1234-5678',
        email: 'contact@testcompany.com',
        address: 'Seoul, Gangnam-gu',
        assignee: 'Park Manager',
        contractDate: '2024-01-15',
        status: 'active'
      },
      {
        companyName: 'Hyundai Steel Co., Ltd.',
        representative: 'Kim Chul-soo',
        businessRegistrationNumber: '123-45-67891',
        contactNumber: '02-1234-5679',
        email: 'contact@hyundaisteel.com',
        address: 'Seoul, Gangnam-gu',
        assignee: 'Park Manager',
        contractDate: '2024-01-15',
        status: 'active'
      },
      {
        companyName: 'Aram Corporation',
        representative: 'Eom Hye-ji',
        businessRegistrationNumber: '123-45-67892',
        contactNumber: '02-1234-5680',
        email: 'contact@aram.com',
        address: 'Seoul, Jung-gu',
        assignee: 'Park Manager',
        contractDate: '2024-02-20',
        status: 'active'
      }
    ];

    for (const clientData of mockClients) {
      await this.prisma.client.create({ data: clientData });
    }

    console.log('✅ Mock data seeded successfully');
  }

  // TP Recording Integration - Lookup helpers
  async getUserByTpCode(tpCode: string): Promise<any | null> {
    const result = await safeAsync(
      () => this.prisma.user.findFirst({
        where: { tpCode }
      }),
      'Failed to find user by TP code'
    );

    return result || null;
  }

  async getClientByTpCode(tpCode: string): Promise<Client | null> {
    const result = await safeAsync(
      () => this.prisma.client.findFirst({
        where: { tpCode }
      }),
      'Failed to find client by TP code'
    );

    if (!result) return null;

    return {
      id: result.id,
      companyName: result.companyName,
      representative: result.representative,
      businessRegistrationNumber: result.businessRegistrationNumber,
      contactNumber: result.contactNumber,
      email: result.email,
      address: result.address,
      assignee: result.assignee,
      contractDate: result.contractDate,
      status: result.status as Client['status'],
      notes: result.notes || undefined,
      tpCode: result.tpCode || undefined
    };
  }

  async getClientByPhone(phoneNumber: string): Promise<Client | null> {
    const result = await safeAsync(
      () => this.prisma.client.findFirst({
        where: { contactNumber: phoneNumber }
      }),
      'Failed to find client by phone number'
    );

    if (!result) return null;

    return {
      id: result.id,
      companyName: result.companyName,
      representative: result.representative,
      businessRegistrationNumber: result.businessRegistrationNumber,
      contactNumber: result.contactNumber,
      email: result.email,
      address: result.address,
      assignee: result.assignee,
      contractDate: result.contractDate,
      status: result.status as Client['status'],
      notes: result.notes || undefined,
      tpCode: result.tpCode || undefined
    };
  }

  async getCallByFileName(fileName: string): Promise<Call | null> {
    const result = await safeAsync(
      () => this.prisma.call.findFirst({
        where: { recordingFileName: fileName },
        include: { client: true }
      }),
      'Failed to find call by filename'
    );

    if (!result) return null;

    return {
      id: result.id,
      date: result.date,
      callerName: result.callerName,
      clientName: result.client?.companyName || null,
      phoneNumber: result.phoneNumber,
      recordingFileName: result.recordingFileName,
      transcriptFileName: '', // Removed field, return empty string for compatibility
      callDuration: result.callDuration,
      transcript: result.transcript
    };
  }

  async updateCallFileExists(callId: string, fileExists: boolean): Promise<void> {
    const result = await safeAsync(
      () => this.prisma.call.update({
        where: { id: callId },
        data: { fileExists }
      }),
      'Failed to update call fileExists status'
    );

    if (!result) {
      throw createError('Failed to update call fileExists status', { callId, fileExists });
    }

    console.log(`✅ Updated fileExists=${fileExists} for call ${callId}`);
  }
}