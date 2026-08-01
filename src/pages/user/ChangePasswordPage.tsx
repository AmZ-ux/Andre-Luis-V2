import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { PasswordInput } from '../../components/auth/PasswordInput'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageSpinner } from '../../components/ui/Spinner'
import { useToast } from '../../contexts/ToastContext'
import { ArrowLeft, Save, AlertCircle } from 'lucide-react'
import {
  validateNewPassword,
  validateConfirmPassword,
  getPasswordStrength,
} from '../../validators/authValidators'

export function ChangePasswordPage() {
  const { user, isLoading, changePassword } = useAuth()
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<{
    currentPassword?: string
    newPassword?: string
    confirmPassword?: string
  }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState('')

  const strength = newPassword ? getPasswordStrength(newPassword) : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors: typeof errors = {}

    if (!currentPassword) {
      newErrors.currentPassword = 'Informe sua senha atual'
    }
    const passResult = validateNewPassword(newPassword)
    if (!passResult.valid) {
      newErrors.newPassword = passResult.error
    }
    const confirmResult = validateConfirmPassword(newPassword, confirmPassword)
    if (!confirmResult.valid) {
      newErrors.confirmPassword = confirmResult.error
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsSubmitting(true)
    setApiError('')

    try {
      await changePassword(currentPassword, newPassword)
      addToast('success', 'Senha alterada com sucesso!')
      navigate('/perfil')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao alterar senha'
      setApiError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading || !user) {
    return <PageSpinner />
  }

  return (
    <div className="space-y-6 sm:space-y-8 max-w-lg mx-auto">
      <div>
        <button
          onClick={() => navigate('/perfil')}
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-light transition-colors mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao perfil
        </button>
        <h1 className="text-xl sm:text-2xl font-bold text-text">Alterar Senha</h1>
        <p className="text-sm text-gray-500 mt-1">Defina uma nova senha para sua conta</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          {apiError && (
            <div className="bg-error/5 border border-error/20 rounded-xl px-4 py-3 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-error shrink-0 mt-0.5" />
              <p className="text-sm text-error">{apiError}</p>
            </div>
          )}

          <PasswordInput
            label="Senha atual"
            placeholder="Digite sua senha atual"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value)
              if (errors.currentPassword)
                setErrors((prev) => ({ ...prev, currentPassword: undefined }))
            }}
            error={errors.currentPassword}
            autoFocus
          />

          <PasswordInput
            label="Nova senha"
            placeholder="Mínimo de 8 caracteres"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value)
              if (errors.newPassword)
                setErrors((prev) => ({ ...prev, newPassword: undefined }))
            }}
            error={errors.newPassword}
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
              { label: 'Mínimo de 8 caracteres', check: newPassword.length >= 8 },
              { label: 'Uma letra maiúscula', check: /[A-Z]/.test(newPassword) },
              { label: 'Uma letra minúscula', check: /[a-z]/.test(newPassword) },
              { label: 'Um número', check: /[0-9]/.test(newPassword) },
              { label: 'Um caractere especial', check: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword) },
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
            label="Confirmar nova senha"
            placeholder="Repita a nova senha"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              if (errors.confirmPassword)
                setErrors((prev) => ({ ...prev, confirmPassword: undefined }))
            }}
            error={errors.confirmPassword}
          />

          <Button type="submit" fullWidth loading={isSubmitting} icon={<Save className="h-4 w-4" />}>
            Salvar nova senha
          </Button>
        </form>
      </Card>
    </div>
  )
}
