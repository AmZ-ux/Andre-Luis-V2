import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { PasswordInput } from '../../components/auth/PasswordInput'
import { Button } from '../../components/ui/Button'
import { ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react'
import { useToast } from '../../contexts/ToastContext'
import {
  validateNewPassword,
  validateConfirmPassword,
  getPasswordStrength,
} from '../../validators/authValidators'
import { authService } from '../../auth/authService'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const { addToast } = useToast()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [apiError, setApiError] = useState('')

  const strength = password ? getPasswordStrength(password) : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const passResult = validateNewPassword(password)
    const confirmResult = validateConfirmPassword(password, confirmPassword)

    if (!passResult.valid || !confirmResult.valid) {
      setErrors({
        password: passResult.error,
        confirmPassword: confirmResult.error,
      })
      return
    }

    if (!token) {
      setApiError('Token de recuperação inválido.')
      return
    }

    setIsLoading(true)
    setApiError('')

    try {
      await authService.resetPassword(token, password)
      setSuccess(true)
      addToast('success', 'Senha redefinida com sucesso!')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao redefinir senha'
      setApiError(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <AuthLayout title="Senha redefinida!" subtitle="Sua senha foi alterada com sucesso">
        <div className="text-center space-y-6">
          <div className="h-16 w-16 rounded-lg bg-success-soft flex items-center justify-center mx-auto">
            <CheckCircle className="h-8 w-8 text-success" />
          </div>
          <Link to="/login">
            <Button>Ir para o login</Button>
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Redefinir senha" subtitle="Crie uma nova senha para sua conta">
      <form onSubmit={handleSubmit} className="space-y-5">
        {apiError && (
          <div className="bg-error/5 border border-error/20 rounded-xl px-4 py-3 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-error shrink-0 mt-0.5" />
            <p className="text-sm text-error">{apiError}</p>
          </div>
        )}

        <PasswordInput
          label="Nova senha"
          placeholder="Mínimo de 8 caracteres"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }))
          }}
          error={errors.password}
          autoFocus
        />

        {strength && (
          <div className="space-y-1">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((level) => (
                <div
                  key={level}
                  className="h-1.5 flex-1 rounded-full"
                  style={{
                    backgroundColor: level <= strength.score ? strength.color : '#e5e7eb',
                  }}
                />
              ))}
            </div>
            <p className="text-xs" style={{ color: strength.color }}>
              {strength.label}
            </p>
          </div>
        )}

        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl px-4 py-3 space-y-1">
          <p className="text-xs font-medium text-text mb-1">Requisitos:</p>
          {[
            { label: 'Mínimo de 8 caracteres', check: password.length >= 8 },
            { label: 'Uma letra maiúscula', check: /[A-Z]/.test(password) },
            { label: 'Uma letra minúscula', check: /[a-z]/.test(password) },
            { label: 'Um número', check: /[0-9]/.test(password) },
            { label: 'Um caractere especial', check: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
          ].map((req) => (
            <p
              key={req.label}
              className={`text-xs ${req.check ? 'text-success' : 'text-gray-400'}`}
            >
              {req.check ? '✓' : '○'} {req.label}
            </p>
          ))}
        </div>

        <PasswordInput
          label="Confirmar senha"
          placeholder="Repita a nova senha"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value)
            if (errors.confirmPassword)
              setErrors((prev) => ({ ...prev, confirmPassword: undefined }))
          }}
          error={errors.confirmPassword}
        />

        <Button type="submit" fullWidth size="lg" loading={isLoading}>
          Redefinir senha
        </Button>

        <div className="text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-light transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao login
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}
