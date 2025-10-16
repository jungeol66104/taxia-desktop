// Shared utility functions for Claude Code development

/**
 * Creates a standardized error with context for easy debugging
 */
export function createError(message: string, context?: any): Error {
  const error = new Error(message);
  if (context) {
    console.error('Error context:', context);
  }
  return error;
}

/**
 * Safe async operation wrapper with error handling
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  errorMessage: string,
  fallback?: T
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    console.error(`${errorMessage}:`, error);
    return fallback ?? null;
  }
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T {
  let timeout: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  }) as T;
}

/**
 * Creates a unique ID for components/entities
 */
export function createId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Format date for Korean locale
 */
export function formatKoreanDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Format Korean phone number
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

/**
 * Deep clone an object safely
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if environment is development
 */
export const isDev = process.env.NODE_ENV !== 'production';

/**
 * Log with timestamp for debugging
 */
export function logWithTimestamp(message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, data || '');
}

/**
 * Safe JSON parsing with fallback
 * Handles malformed JSON, markdown code fences, and null values
 */
export function safeJSONParse<T>(text: string | null | undefined, fallback: T): T {
  if (!text || typeof text !== 'string') {
    return fallback;
  }

  try {
    // Remove markdown code fences if present
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    return JSON.parse(cleaned);
  } catch (error) {
    console.error('❌ JSON parse error:', error);
    console.error('❌ Failed to parse text:', text?.slice(0, 200));
    return fallback;
  }
}

/**
 * Safe string initials generator
 * Handles null, undefined, and empty strings
 */
export function getInitials(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') {
    return '??';
  }

  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return '??';
  }

  const parts = trimmed.split(' ').filter(p => p.length > 0);
  if (parts.length === 0) {
    return '??';
  }

  return parts.map(part => part[0]).join('').toUpperCase().slice(0, 2);
}

/**
 * Safe array access with bounds checking
 */
export function safeArrayAccess<T>(array: T[] | null | undefined, index: number): T | null {
  if (!array || !Array.isArray(array) || index < 0 || index >= array.length) {
    return null;
  }
  return array[index];
}