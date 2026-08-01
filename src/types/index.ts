export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'
export type BadgeVariant = 'primary' | 'success' | 'warning' | 'error' | 'neutral'
export type AvatarSize = 'sm' | 'md' | 'lg'
export type ToastType = 'success' | 'error' | 'warning' | 'info'
export type SkeletonVariant = 'text' | 'circle' | 'rect'
export type Position = 'left' | 'right'

export interface NavItem {
  label: string
  path: string
  icon: string
}

export interface ToastMessage {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

export interface Column {
  key: string
  label: string
  align?: 'left' | 'center' | 'right'
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode
}
