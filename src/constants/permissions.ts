import type { UserRole } from '../types/auth'

export type Permission =
  | 'dashboard'
  | 'passengers'
  | 'payments'
  | 'settings'
  | 'profile'
  | 'communication'
  | 'myAvailability'

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: ['dashboard', 'passengers', 'payments', 'settings', 'profile', 'communication'],
  passenger: ['dashboard', 'myAvailability', 'profile'],
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  passenger: 'Passageiro',
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function getRoleLabel(role: UserRole): string {
  return ROLE_LABELS[role]
}

export const SESSION_CONFIG = {
  defaultExpiryMs: 30 * 60 * 1000,
  rememberMeExpiryMs: 7 * 24 * 60 * 60 * 1000,
  renewalThresholdMs: 5 * 60 * 1000,
  storageKey: 'auth_session',
  userKey: 'auth_user',
  userListKey: 'app_users',
} as const
