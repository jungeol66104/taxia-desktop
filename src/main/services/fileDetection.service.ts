import { BrowserWindow } from 'electron';
import { FileDetectionHandlerInterface, DatabaseServiceInterface, OpenAIServiceInterface } from './interfaces';
import { Call } from '../../shared/types';
import { APP_CONSTANTS } from '../../shared/constants';
import { parseBuffer } from 'music-metadata';
import * as fs from 'fs';

// New interface for local file detection
export interface LocalFileInfo {
  localFilePath: string;
  fileName: string;
  timestamp: string;
}

// TP filename parsing interface
export interface TPFileNameParsed {
  userTpCode: string;
  clientTpCode: string;
  callDateTime: Date;
  isClientPhone: boolean;
  originalFileName: string;
}

export class FileDetectionService implements FileDetectionHandlerInterface {
  private mainWindow: BrowserWindow;
  private databaseService?: DatabaseServiceInterface;
  private openaiService?: OpenAIServiceInterface;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  setOpenAIService(service: OpenAIServiceInterface): void {
    this.openaiService = service;
  }

  setDatabaseService(service: DatabaseServiceInterface): void {
    this.databaseService = service;
  }

  handleFileDetected(fileInfo: LocalFileInfo): void {
    console.log('📁 Local file detected:', fileInfo);

    // Only require Database service
    if (!this.databaseService) {
      console.error('❌ Required services not configured (Database)');
      return;
    }

    console.log('🔄 Starting local file processing...');

    // Process local file directly (no download needed)
    this.processLocalFile(fileInfo);
  }

  private async processLocalFile(fileInfo: LocalFileInfo): Promise<void> {
    try {
      console.log('🔄 Processing local file:', fileInfo.fileName);

      // Check if file already exists in database (de-duplication)
      const existingCall = await this.databaseService!.getCallByFileName(fileInfo.fileName);
      if (existingCall) {
        console.log(`⏭️  File ${fileInfo.fileName} already exists in DB with ID ${existingCall.id}, skipping`);
        return;
      }

      // Parse TP filename for metadata
      const parsedTP = this.parseTPFileName(fileInfo.fileName);

      // Lookup user and client from database
      let foundUser: any | null = null;
      let foundClient: any | null = null;

      if (parsedTP) {
        console.log('📋 Parsed TP data:', parsedTP);

        // Lookup user by TP code
        foundUser = await this.databaseService!.getUserByTpCode(parsedTP.userTpCode);
        if (foundUser) {
          console.log(`✅ Found user: ${foundUser.name} (TP code: ${parsedTP.userTpCode})`);
        } else {
          console.log(`⚠️  User not found for TP code: ${parsedTP.userTpCode}`);
        }

        // Lookup client by TP code or phone
        if (parsedTP.isClientPhone) {
          console.log(`🔍 Searching for client by phone number: ${parsedTP.clientTpCode}`);
          foundClient = await this.databaseService!.getClientByPhone(parsedTP.clientTpCode);
        } else {
          console.log(`🔍 Searching for client by TP code: ${parsedTP.clientTpCode}`);
          foundClient = await this.databaseService!.getClientByTpCode(parsedTP.clientTpCode);
        }

        if (foundClient) {
          console.log(`✅ Found client: ${foundClient.companyName} (${parsedTP.clientTpCode})`);
        } else {
          console.log(`⚠️  Client not found for: ${parsedTP.clientTpCode}`);
        }
      }

      // Extract audio duration
      const callDuration = await this.extractAudioDuration(fileInfo.localFilePath);

      // Create call record in database with enriched data
      console.log(`💾 Creating call record in database...`);

      const callData: Omit<Call, 'id'> & { clientId?: string; userId?: string; transcript?: string } = {
        date: parsedTP ? parsedTP.callDateTime.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        callerName: foundUser?.name || '미확인',
        clientName: foundClient?.companyName || (parsedTP?.isClientPhone ? `전화: ${parsedTP.clientTpCode}` : '미확인'),
        phoneNumber: parsedTP?.isClientPhone ? parsedTP.clientTpCode : (foundClient?.contactNumber || ''),
        recordingFileName: fileInfo.fileName,
        transcriptFileName: '', // Removed field
        callDuration: callDuration,
        clientId: foundClient?.id || null,
        userId: foundUser?.id || null,
        transcript: null // Will be updated by background STT processing
      };

      const savedCall = await this.databaseService!.createCall(callData);
      console.log(`✅ Call saved to database with ID: ${savedCall.id}`);

      // Notify UI to refresh calls data table
      this.mainWindow.webContents.send(APP_CONSTANTS.IPC_CHANNELS.CREATE_NEW_CALL, {
        callData: savedCall,
        fileName: fileInfo.fileName,
        timestamp: new Date().toISOString()
      });
      console.log(`📤 Sent CREATE_NEW_CALL event to refresh UI data table`);

      // Start background STT processing if we have OpenAI service
      if (this.openaiService) {
        console.log(`🎤 Starting background STT processing for call ID: ${savedCall.id}`);
        this.processSTTInBackground(savedCall.id, fileInfo.localFilePath, fileInfo.fileName);
      } else {
        console.log(`🔄 Skipping STT processing - OpenAI service not available`);
      }

      console.log(`🎉 File processing completed successfully for: ${fileInfo.fileName}`);
      console.log(`📋 Call record created - check 통화 목록 tab to see the new entry`);
      console.log(`📁 Local file path: ${fileInfo.localFilePath}`);

    } catch (error) {
      console.error('❌ Local file processing failed:', error);
      console.log(`💡 Error details:`, error instanceof Error ? error.message : String(error));
    }
  }

  private async processSTTInBackground(callId: number, audioFilePath: string, fileName: string): Promise<void> {
    try {
      console.log(`🎤 Starting STT processing for call ${callId}: ${fileName}`);

      // Transcribe audio using OpenAI Whisper
      const transcript = await this.openaiService!.transcribeAudio(audioFilePath);

      if (!transcript || transcript.trim().length === 0) {
        console.error(`❌ STT failed for call ${callId}: Empty transcript`);
        return;
      }

      console.log(`✅ STT completed for call ${callId}. Length: ${transcript.length} characters`);

      // Update database with transcript
      if (this.databaseService) {
        await this.databaseService.updateCallTranscript(callId, transcript);
        console.log(`✅ Transcript saved to database for call ${callId}`);

        // Notify UI that transcript is available
        this.mainWindow.webContents.send(APP_CONSTANTS.IPC_CHANNELS.TRANSCRIPT_UPDATED, {
          callId: callId,
          transcript: transcript,
          timestamp: new Date().toISOString()
        });
        console.log(`📤 Sent TRANSCRIPT_UPDATED event for call ${callId}`);

        // Extract tasks from transcript using LLM
        console.log(`🧠 ============================================`);
        console.log(`🧠 Starting task extraction from transcript for call ${callId}`);
        console.log(`🧠 Transcript preview: ${transcript.substring(0, 100)}...`);
        console.log(`🧠 ============================================`);

        const extractedTasks = await this.openaiService!.extractTasks(transcript);

        console.log(`🧠 ============================================`);
        console.log(`🧠 Task extraction completed for call ${callId}`);
        console.log(`🧠 Number of tasks extracted: ${extractedTasks?.length || 0}`);
        console.log(`🧠 ============================================`);

        // Get or create Taxia user (needed for both cases)
        let taxiaUser = await this.databaseService.getUserByRole('taxia');
        if (!taxiaUser) {
          // Create Taxia user if it doesn't exist
          taxiaUser = await this.databaseService.createUser({
            name: 'Taxia',
            email: 'taxia@system.ai',
            password: 'system',
            role: 'taxia'
          });
          console.log(`✅ Created Taxia system user with ID: ${taxiaUser.id}`);
        }

        if (extractedTasks && extractedTasks.length > 0) {
          console.log(`✅ Extracted ${extractedTasks.length} tasks from transcript`);

          // Create a message with extracted tasks as JSON
          const tasksData = extractedTasks.map(task => ({
            id: task.id,
            title: task.title,
            startDate: task.startDate,
            dueDate: task.dueDate,
            assignee: '',
            clientId: null
          }));

          const message = await this.databaseService.createMessage({
            userId: taxiaUser.id,
            content: '통화 내용에서 다음 업무들을 추출했습니다:',
            callId: callId,
            metadata: JSON.stringify({ candidateTasks: tasksData })
          });

          console.log(`✅ Created message with candidate tasks for call ${callId}`);

          // Notify UI about the new message with tasks
          this.mainWindow.webContents.send(APP_CONSTANTS.IPC_CHANNELS.TASKS_EXTRACTED, {
            callId: callId,
            message: {
              ...message,
              candidateTasks: tasksData
            },
            timestamp: new Date().toISOString()
          });
          console.log(`📤 Sent TASKS_EXTRACTED event for call ${callId} with ${tasksData.length} tasks`);
        } else {
          console.log(`📝 No tasks extracted from transcript for call ${callId}`);

          // Create a message even when no tasks are found
          const message = await this.databaseService.createMessage({
            userId: taxiaUser.id,
            content: '통화 내용을 분석했지만 추출할 업무가 없습니다.',
            callId: callId,
            metadata: JSON.stringify({ candidateTasks: [] })
          });

          console.log(`✅ Created message with no tasks for call ${callId}`);

          // Notify UI about the message (with empty tasks array)
          this.mainWindow.webContents.send(APP_CONSTANTS.IPC_CHANNELS.TASKS_EXTRACTED, {
            callId: callId,
            message: {
              ...message,
              candidateTasks: []
            },
            timestamp: new Date().toISOString()
          });
          console.log(`📤 Sent TASKS_EXTRACTED event for call ${callId} with 0 tasks`);
        }
      }

    } catch (error) {
      console.error(`❌ ============================================`);
      console.error(`❌ Background STT processing failed for call ${callId}`);
      console.error(`❌ Error type: ${error?.constructor?.name}`);
      console.error(`❌ Error message: ${error?.message}`);
      console.error(`❌ Full error:`, error);
      console.error(`❌ ============================================`);
    }
  }

  private async extractAudioDuration(filePath: string): Promise<string> {
    try {
      console.log(`🎵 Reading audio file buffer from: ${filePath}`);

      // Read file as buffer using Node.js fs
      const fileBuffer = await fs.promises.readFile(filePath);
      console.log(`✅ File buffer read successfully, size: ${fileBuffer.length} bytes`);

      // Parse metadata from buffer
      const metadata = await parseBuffer(fileBuffer);
      const durationInSeconds = metadata.format.duration;

      if (!durationInSeconds) {
        console.log('⚠️ Could not extract duration from audio file, using default');
        return '0:00';
      }

      // Convert seconds to MM:SS format
      const minutes = Math.floor(durationInSeconds / 60);
      const seconds = Math.floor(durationInSeconds % 60);
      const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

      console.log(`🎵 Extracted audio duration: ${formattedDuration} (${durationInSeconds.toFixed(1)}s)`);
      return formattedDuration;
    } catch (error) {
      console.error('❌ Failed to extract audio duration:', error);
      console.error('📍 Error details:', error instanceof Error ? error.message : String(error));
      return '0:00'; // Fallback to default
    }
  }

  /**
   * Parse TP filename to extract metadata
   * Format: {userTpCode}-{clientTpCode}_{timestamp}_mix.wav
   * Example: 0400-01052913391_20250915134049_mix.wav
   */
  private parseTPFileName(fileName: string): TPFileNameParsed | null {
    try {
      // Format: 0500-400_20250915140634_mix.wav or 0400-01052913391_20250915134049_mix.wav
      const regex = /^(\d+)-(\d+)_(\d{14})_mix\.wav$/;
      const match = fileName.match(regex);

      if (!match) {
        console.log(`⚠️  File "${fileName}" does not match TP naming convention`);
        return null;
      }

      const [, userTpCode, clientTpCode, timestamp] = match;

      // Parse timestamp: YYYYMMDDHHMMSS
      const year = parseInt(timestamp.slice(0, 4));
      const month = parseInt(timestamp.slice(4, 6)) - 1; // 0-indexed
      const day = parseInt(timestamp.slice(6, 8));
      const hour = parseInt(timestamp.slice(8, 10));
      const minute = parseInt(timestamp.slice(10, 12));
      const second = parseInt(timestamp.slice(12, 14));

      const callDateTime = new Date(year, month, day, hour, minute, second);

      // Detect if clientTpCode is a phone number
      // Phone numbers in Korea: 010XXXXXXXX (11 digits) or longer
      // Regular TP codes are typically 3-4 digits
      const isClientPhone = clientTpCode.length >= 9;

      console.log(`✅ Parsed TP filename: user=${userTpCode}, client=${clientTpCode} (${isClientPhone ? 'phone' : 'code'}), time=${callDateTime.toISOString()}`);

      return {
        userTpCode,
        clientTpCode,
        callDateTime,
        isClientPhone,
        originalFileName: fileName
      };
    } catch (error) {
      console.error('❌ Failed to parse TP filename:', error);
      return null;
    }
  }
}
