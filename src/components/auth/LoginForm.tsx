import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { Input } from '../ui/Input'
import { PasswordInput } from './PasswordInput'
import { Checkbox } from '../ui/Checkbox'
import { Button } from '../ui/Button'
import { Link } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { validateLogin, validatePassword } from '../../validators/authValidators'
import type { LoginCredentials } from '../../types/auth'

export function LoginForm() {
  const { login, isLoading, error } = useAuth()
  const { addToast } = useToast()

  const [credentials, setCredentials] = useState<LoginCredentials>({
    login: '',
    password: '',
    rememberMe: false,
  })
  const [errors, setErrors] = useState<{ login?: string; password?: string }>({})

  const handleChange = (field: keyof LoginCredentials, value: string | boolean) => {
    setCredentials((prev) => ({ ...prev, [field]: value }))
    if (errors[field as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const loginResult = validateLogin(credentials.login)
    const passwordResult = validatePassword(credentials.password)

    if (!loginResult.valid || !passwordResult.valid) {
      setErrors({
        login: loginResult.error,
        password: passwordResult.error,
      })
      return
    }

    try {
      await login(credentials)
      addToast('success', 'Login realizado com sucesso!')
    } catch {
      addToast('error', 'Falha na autenticação', 'Verifique suas credenciais e tente novamente.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        label="Email ou CPF"
        placeholder="Digite seu email ou CPF"
        value={credentials.login}
        onChange={(e) => handleChange('login', e.target.value)}
        error={errors.login}
        autoComplete="username"
        autoFocus
      />

      <PasswordInput
        label="Senha"
        placeholder="Digite sua senha"
        value={credentials.password}
        onChange={(e) => handleChange('password', e.target.value)}
        error={errors.password}
        autoComplete="current-password"
      />

      <div className="flex items-center justify-between">
        <Checkbox
          label="Lembrar-me"
          checked={credentials.rememberMe}
          onChange={(e) => handleChange('rememberMe', e.target.checked)}
        />
        <Link
          to="/esqueci-minha-senha"
          className="text-sm font-medium text-primary hover:text-primary-light transition-colors"
        >
          Esqueci minha senha
        </Link>
      </div>

      {error && (
        <div className="bg-error/5 border border-error/20 rounded-xl px-4 py-3" role="alert">
          <p className="text-sm text-error font-medium">{error}</p>
        </div>
      )}

      <Button
        type="submit"
        fullWidth
        size="lg"
        loading={isLoading}
        icon={<LogIn className="h-4 w-4" />}
      >
        Entrar
      </Button>

      <div className="text-center">
        <span className="text-sm text-gray-500 dark:text-gray-400">Não tem uma conta? </span>
        <Link
          to="/cadastro"
          className="text-sm font-medium text-primary hover:text-primary-light transition-colors"
        >
          Cadastre-se
        </Link>
      </div>
    </form>
  )
}
