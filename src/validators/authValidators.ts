import type { PasswordStrength } from '../types/auth'

export interface ValidationResult {
  valid: boolean
  error?: string
}

export function validateLogin(login: string): ValidationResult {
  if (!login || login.trim().length === 0) {
    return { valid: false, error: 'Informe seu email ou CPF' }
  }
  return { valid: true }
}

export function validatePassword(password: string): ValidationResult {
  if (!password || password.length === 0) {
    return { valid: false, error: 'Informe sua senha' }
  }
  return { valid: true }
}

export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim().length === 0) {
    return { valid: false, error: 'Informe seu email' }
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.trim())) {
    return { valid: false, error: 'Email inválido' }
  }
  return { valid: true }
}

export function validateNewPassword(password: string): ValidationResult {
  if (!password || password.length < 8) {
    return { valid: false, error: 'Mínimo de 8 caracteres' }
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Deve conter uma letra maiúscula' }
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Deve conter uma letra minúscula' }
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Deve conter um número' }
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, error: 'Deve conter um caractere especial' }
  }
  return { valid: true }
}

export function validateConfirmPassword(password: string, confirmPassword: string): ValidationResult {
  if (password !== confirmPassword) {
    return { valid: false, error: 'Senhas não conferem' }
  }
  return { valid: true }
}

export function getPasswordStrength(password: string): PasswordStrength {
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++

  if (score <= 1) return { score, label: 'Muito fraca', color: '#EF4444' }
  if (score === 2) return { score, label: 'Fraca', color: '#F59E0B' }
  if (score <= 3) return { score, label: 'Média', color: '#EAB308' }
  if (score <= 4) return { score, label: 'Forte', color: '#22C55E' }
  return { score, label: 'Muito forte', color: '#16A34A' }
}
