/**
 * User role constants and display mappings
 */

export const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  AGENT: 'agent',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

/**
 * Korean display names for user roles
 */
export const ROLE_DISPLAY_KR: Record<UserRole, string> = {
  admin: '관리자',
  user: '사용자',
  agent: '에이전트',
} as const;

/**
 * Role descriptions in Korean
 */
export const ROLE_DESCRIPTIONS_KR: Record<UserRole, string> = {
  admin: '모든 권한을 가진 관리자',
  user: '일반 사용자',
  agent: 'AI 에이전트',
} as const;

/**
 * Get Korean display name for a role
 */
export function getRoleDisplayName(role: string): string {
  return ROLE_DISPLAY_KR[role as UserRole] || role;
}

/**
 * Get role description in Korean
 */
export function getRoleDescription(role: string): string {
  return ROLE_DESCRIPTIONS_KR[role as UserRole] || '';
}
