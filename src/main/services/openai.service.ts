import OpenAI from 'openai';
import fs from 'fs';
import { OpenAIServiceInterface } from './interfaces';
import { Task } from '../../shared/types';
import { createError, safeAsync, safeJSONParse } from '../../shared/utils';
import { DatabaseService } from './database.service';

export class OpenAIService implements OpenAIServiceInterface {
  private client: OpenAI | null = null;
  private running = false;
  private databaseService: DatabaseService | null = null;

  constructor(apiKey?: string) {
    // If API key provided, initialize immediately (for backwards compatibility)
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
    // Otherwise, will be initialized lazily when needed
  }

  /**
   * Set database service for loading API key dynamically
   */
  setDatabaseService(databaseService: DatabaseService): void {
    this.databaseService = databaseService;
  }

  /**
   * Ensure OpenAI client is initialized
   * Loads API key from database if not already initialized
   */
  private async ensureClient(): Promise<void> {
    if (this.client) return; // Already initialized

    if (!this.databaseService) {
      throw createError('OpenAI API key not configured and database service not available');
    }

    const apiKey = await this.databaseService.getSetting('openai_api_key');
    if (!apiKey) {
      throw createError('OpenAI API key not configured. Please add it in Settings.');
    }

    this.client = new OpenAI({ apiKey });
    console.log('🔐 OpenAI client initialized with API key from database');
  }

  isRunning(): boolean {
    return this.running;
  }

  async start(): Promise<void> {
    this.running = true;
    console.log('✅ OpenAI service started');
  }

  async stop(): Promise<void> {
    this.running = false;
    console.log('🛑 OpenAI service stopped');
  }

  async transcribeAudio(audioFilePath: string): Promise<string> {
    await this.ensureClient(); // Load API key from database if needed

    // Validate file exists
    if (!fs.existsSync(audioFilePath)) {
      throw createError('Audio file not found', { audioFilePath });
    }

    // Validate file size (Whisper has 25MB limit)
    const stats = fs.statSync(audioFilePath);
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (stats.size > maxSize) {
      throw createError('Audio file too large (max 25MB)', {
        audioFilePath,
        size: stats.size,
        maxSize
      });
    }

    if (stats.size === 0) {
      throw createError('Audio file is empty', { audioFilePath });
    }

    // Validate file is readable
    try {
      fs.accessSync(audioFilePath, fs.constants.R_OK);
    } catch {
      throw createError('Audio file not readable', { audioFilePath });
    }

    const result = await safeAsync(
      async () => {
        console.log('🎤 Starting transcription for:', audioFilePath);

        const transcription = await this.client!.audio.transcriptions.create({
          file: fs.createReadStream(audioFilePath),
          model: "whisper-1",
          language: "ko" // Korean language
        });

        console.log('✅ Transcription completed');
        return transcription.text;
      },
      'Failed to transcribe audio'
    );

    if (!result) {
      throw createError('Audio transcription failed', { audioFilePath });
    }

    return result;
  }

  async extractTasks(transcript: string, clientName?: string): Promise<Task[]> {
    await this.ensureClient(); // Load API key from database if needed

    const result = await safeAsync(
      async () => {
        console.log('🧠 Starting task extraction from transcript');

        const prompt = `다음은 세무서 직원과 고객의 통화 내용입니다. 이 통화에서 해야 할 업무들을 추출해주세요.

통화 내용:
${transcript}

${clientName ? `고객명: ${clientName}` : ''}

다음 형식의 JSON 배열로 응답해주세요. 업무가 없다면 빈 배열을 반환하세요:
[
  {
    "title": "업무 제목",
    "description": "상세 설명",
    "priority": "high|normal|low",
    "category": "업무 카테고리",
    "dueDate": "YYYY-MM-DD (추정)",
    "tags": ["tag1", "tag2"]
  }
]

중요한 지침:
- 실제로 해야 할 구체적인 업무만 추출하세요
- 단순한 상담이나 질문은 업무로 추출하지 마세요
- 우선순위는 업무의 긴급성과 중요도를 고려하세요
- 카테고리는 "세무신고", "상담", "회계", "법무", "기타" 중 선택하세요
- 마감일은 통화 내용을 바탕으로 합리적으로 추정하세요`;

        const completion = await this.client!.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: "당신은 세무서에서 일하는 업무 관리 전문가입니다. 통화 내용을 분석하여 실행 가능한 업무를 추출하는 것이 전문입니다."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 1500
        });

        const responseText = completion.choices[0]?.message?.content;
        if (!responseText) {
          console.log('📝 No tasks extracted from transcript');
          return [];
        }

        // Parse JSON response with safe parsing (handles markdown fences, malformed JSON, etc)
        const extractedTasks = safeJSONParse<any[]>(responseText, []);

        if (extractedTasks.length === 0) {
          console.log('📝 No tasks extracted from transcript (empty or malformed response)');
          return [];
        }

        try {

          // Convert to our Task format with additional required fields
          const tasks: Task[] = extractedTasks.map((task: any, index: number) => ({
            id: Date.now() + index, // Temporary ID
            title: task.title,
            description: task.description,
            clientName: clientName || 'Unknown Client',
            assignee: 'Auto-assigned', // To be assigned by user
            status: 'pending' as const,
            priority: task.priority || 'normal',
            startDate: new Date().toISOString().split('T')[0],
            dueDate: task.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Default 7 days
            createdAt: new Date().toISOString(),
            progress: 0,
            category: task.category || '기타',
            tags: task.tags || []
          }));

          console.log(`✅ Extracted ${tasks.length} tasks from transcript`);
          return tasks;

        } catch (mapError) {
          console.error('❌ Failed to map task data:', mapError);
          console.error('❌ Extracted tasks data:', extractedTasks);
          // Return empty array instead of crashing
          return [];
        }
      },
      'Failed to extract tasks from transcript'
    );

    if (!result) {
      throw createError('Task extraction failed', { transcript });
    }

    return result;
  }
}