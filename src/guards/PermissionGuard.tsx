import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { Permission } from '../constants/permissions'
import { hasPermission } from '../constants/permissions'

interface PermissionGuardProps {
  permission: Permission
  children: ReactNode
  fallback?: ReactNode
}

export function PermissionGuard({ permission, children, fallback }: PermissionGuardProps) {
  const { user } = useAuth()

  if (!user) return null

  if (!hasPermission(user.role, permission)) {
    return fallback ?? null
  }

  return <>{children}</>
}
