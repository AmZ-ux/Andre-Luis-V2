export type UserRole = 'admin' | 'passenger'

export interface User {
  id: string
  name: string
  email: string
  cpf: string
  phone: string
  photo?: string
  role: UserRole
  superAdmin?: boolean
  emailVerified?: boolean
  createdAt: string
  lastAccess: string
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

export interface LoginCredentials {
  login: string
  password: string
  rememberMe: boolean
}

export interface RegisterCredentials {
  name: string
  email: string
  cpf: string
  phone: string
  password: string
  transportType: 'university' | 'contract'
  pickupPoint: string
  destination: string
  contractStartDate: string
  monthlyFee: string
}

export interface ForgotPasswordData {
  email: string
}

export interface ResetPasswordData {
  token: string
  password: string
  confirmPassword: string
}

export interface ChangePasswordData {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface AuthResponse {
  user: User
  token: string
  expiresAt: number
}

export interface PasswordStrength {
  score: number
  label: 'Muito fraca' | 'Fraca' | 'Média' | 'Forte' | 'Muito forte'
  color: string
}
