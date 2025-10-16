import Store from 'electron-store';
import { randomBytes } from 'crypto';
import { DatabaseService } from './database.service';

interface SessionData {
  userId: string;  // UUID
  email: string;
  name: string;
  role: string;
  sessionToken: string;
  expiresAt: string;
  lastAccessAt: string;
  createdAt: string;
}

interface UserData {
  id: string;  // UUID
  name: string;
  email: string;
  role: string;
}

export class SessionManager {
  private store: Store<{ session?: SessionData }>;
  private readonly SESSION_DURATION_DAYS = 30; // 30 days default

  constructor() {
    this.store = new Store({
      name: 'taxia-session',
      encryptionKey: 'taxia-session-encryption-key-2024',
      schema: {
        session: {
          type: 'object',
          properties: {
            userId: { type: 'string' },  // UUID
            email: { type: 'string' },
            name: { type: 'string' },
            role: { type: 'string' },
            sessionToken: { type: 'string' },
            expiresAt: { type: 'string' },
            lastAccessAt: { type: 'string' },
            createdAt: { type: 'string' }
          }
        }
      }
    });
  }

  /**
   * Create a new session for a user
   */
  createSession(userData: UserData): SessionData {
    const sessionToken = this.generateSessionToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (this.SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000));

    const sessionData: SessionData = {
      userId: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role,
      sessionToken,
      expiresAt: expiresAt.toISOString(),
      lastAccessAt: now.toISOString(),
      createdAt: now.toISOString()
    };

    // Save to encrypted store
    this.store.set('session', sessionData);

    console.log('✅ Session created successfully:', {
      userId: sessionData.userId,
      email: sessionData.email,
      expiresAt: sessionData.expiresAt
    });

    return sessionData;
  }

  /**
   * Get current session if valid
   */
  async getValidSession(databaseService?: DatabaseService): Promise<UserData | null> {
    try {
      const session = this.store.get('session');

      if (!session) {
        console.log('📝 No session found in store');
        return null;
      }

      // Check if session is expired
      const now = new Date();
      const expiresAt = new Date(session.expiresAt);

      if (now > expiresAt) {
        console.log('⏰ Session expired, clearing...');
        this.clearSession();
        return null;
      }

      // If database service is available, verify user still exists
      if (databaseService) {
        try {
          const user = await databaseService.getUserByEmail(session.email);
          if (!user) {
            console.log('👤 User no longer exists in database, clearing session');
            this.clearSession();
            return null;
          }

          // Update user data in case it changed in database
          session.name = user.name;
          session.role = user.role;
        } catch (error) {
          console.error('❌ Error validating user in database:', error);
          // Continue with cached session data if database check fails
        }
      }

      // Update last access time
      session.lastAccessAt = now.toISOString();
      this.store.set('session', session);

      console.log('✅ Valid session found:', {
        userId: session.userId,
        email: session.email,
        lastAccess: session.lastAccessAt
      });

      return {
        id: session.userId,
        name: session.name,
        email: session.email,
        role: session.role
      };

    } catch (error) {
      console.error('❌ Error reading session:', error);
      this.clearSession();
      return null;
    }
  }

  /**
   * Clear current session (logout)
   */
  clearSession(): void {
    try {
      this.store.delete('session');
      console.log('✅ Session cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing session:', error);
    }
  }

  /**
   * Check if a valid session exists without database validation
   */
  hasValidSession(): boolean {
    try {
      const session = this.store.get('session');

      if (!session) {
        return false;
      }

      const now = new Date();
      const expiresAt = new Date(session.expiresAt);

      return now <= expiresAt;
    } catch (error) {
      console.error('❌ Error checking session validity:', error);
      return false;
    }
  }

  /**
   * Extend current session expiration
   */
  extendSession(): void {
    try {
      const session = this.store.get('session');

      if (!session) {
        return;
      }

      const now = new Date();
      const newExpiresAt = new Date(now.getTime() + (this.SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000));

      session.expiresAt = newExpiresAt.toISOString();
      session.lastAccessAt = now.toISOString();

      this.store.set('session', session);

      console.log('🔄 Session extended until:', newExpiresAt.toISOString());
    } catch (error) {
      console.error('❌ Error extending session:', error);
    }
  }

  /**
   * Get session info for debugging
   */
  getSessionInfo(): any {
    try {
      const session = this.store.get('session');

      if (!session) {
        return { exists: false };
      }

      return {
        exists: true,
        userId: session.userId,
        email: session.email,
        expiresAt: session.expiresAt,
        lastAccessAt: session.lastAccessAt,
        createdAt: session.createdAt,
        isExpired: new Date() > new Date(session.expiresAt)
      };
    } catch (error) {
      return { exists: false, error: error.message };
    }
  }

  /**
   * Generate a secure session token
   */
  private generateSessionToken(): string {
    return randomBytes(32).toString('hex');
  }
}