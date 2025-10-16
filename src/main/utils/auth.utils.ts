import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { DatabaseService } from '../services/database.service';

const SALT_ROUNDS = 12;

/**
 * JWT Secret Key
 * Loaded from database (auto-generated on first startup)
 * Falls back to default for development/testing
 */
let JWT_SECRET = 'taxia-desktop-secret-key-change-in-production';

/**
 * Initialize JWT secret from database
 * Must be called after DatabaseService starts
 */
export async function initializeJwtSecret(databaseService: DatabaseService): Promise<void> {
  const secret = await databaseService.getSetting('jwt_secret');
  if (secret) {
    JWT_SECRET = secret;
    console.log('🔐 JWT secret loaded from database for auth');
  } else {
    console.warn('⚠️ JWT secret not found in database, using fallback');
  }
}

/**
 * JWT token expiration time
 * Default: 7 days
 */
const TOKEN_EXPIRY = '7d';

/**
 * User payload for JWT token
 */
export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export class AuthUtils {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate a JWT token for a user
   *
   * @param payload - User information to encode in the token
   * @returns JWT token string
   *
   * @example
   * const token = AuthUtils.generateToken({
   *   userId: '123',
   *   email: 'user@example.com',
   *   role: 'admin'
   * });
   * // Returns: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   */
  static generateToken(payload: JwtPayload): string {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: TOKEN_EXPIRY
    });
  }

  /**
   * Verify and decode a JWT token
   *
   * @param token - JWT token string to verify
   * @returns Decoded payload if valid, null if invalid
   *
   * @example
   * const payload = AuthUtils.verifyToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
   * if (payload) {
   *   console.log('User ID:', payload.userId);
   * } else {
   *   console.log('Invalid token');
   * }
   */
  static verifyToken(token: string): JwtPayload | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      return decoded;
    } catch (error) {
      // Token is invalid, expired, or malformed
      console.error('Token verification failed:', error.message);
      return null;
    }
  }

  /**
   * Extract token from Authorization header
   *
   * @param authHeader - Authorization header value (e.g., "Bearer eyJhbGci...")
   * @returns Token string without "Bearer " prefix, or null if invalid format
   *
   * @example
   * const token = AuthUtils.extractTokenFromHeader('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
   * // Returns: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   */
  static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
      return null;
    }

    // Expected format: "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }
}