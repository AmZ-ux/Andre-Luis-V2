import { useState, useEffect } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { Input } from '../ui/Input'
import { PasswordInput } from './PasswordInput'
import { Checkbox } from '../ui/Checkbox'
import { Button } from '../ui/Button'
import { Link } from 'react-router-dom'
import { LogIn, Mail, ShieldCheck, RotateCcw, ArrowLeft } from 'lucide-react'
import { validateLogin, validatePassword } from '../../validators/authValidators'
import type { LoginCredentials } from '../../types/auth'
import { authService } from '../../auth/authService'

export function LoginForm({ initialVerifyEmail }: { initialVerifyEmail?: string }) {
  const { login, isLoading, error } = useAuth()
  const { addToast } = useToast()

  const [credentials, setCredentials] = useState<LoginCredentials>({
    login: '',
    password: '',
    rememberMe: false,
  })
  const [errors, setErrors] = useState<{ login?: string; password?: string }>({})

  const [verificationEmail, setVerificationEmail] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [sendingCode, setSendingCode] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [verificationMessage, setVerificationMessage] = useState('')

  useEffect(() => {
    if (initialVerifyEmail && !verificationEmail) {
      setVerificationEmail(initialVerifyEmail)
      void handleSendCode(initialVerifyEmail)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialVerifyEmail])

  const handleChange = (field: keyof LoginCredentials, value: string | boolean) => {
    setCredentials((prev) => ({ ...prev, [field]: value }))
    if (errors[field as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const startCooldown = () => {
    setResendCooldown(60)
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleSendCode = async (email: string) => {
    setSendingCode(true)
    setCodeError('')
    setVerificationMessage('')
    try {
      const res = await authService.sendVerificationEmailPublic(email)
      if (res.alreadyVerified) {
        setVerificationMessage('Seu email já está verificado. Faça login novamente.')
      } else {
        setVerificationMessage('Enviamos um código para o seu email. Ele expira em 30 minutos.')
        startCooldown()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar o código'
      setCodeError(message)
    } finally {
      setSendingCode(false)
    }
  }

  const handleConfirmCode = async () => {
    if (!verificationEmail) return
    if (code.trim().length !== 6) {
      setCodeError('Digite o código de 6 dígitos')
      return
    }
    setConfirming(true)
    setCodeError('')
    try {
      await authService.confirmVerificationEmailPublic(verificationEmail, code)
      addToast('success', 'Email verificado! Entrando...')
      setVerificationEmail(null)
      setCode('')
      await login({ ...credentials })
      addToast('success', 'Login realizado com sucesso!')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Código incorreto'
      setCodeError(message)
    } finally {
      setConfirming(false)
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
    } catch (err: any) {
      if (err?.code === 'EMAIL_NOT_VERIFIED') {
        const email = credentials.login.includes('@')
          ? credentials.login.trim().toLowerCase()
          : ''
        setVerificationEmail(email || credentials.login)
        if (email) {
          void handleSendCode(email)
        } else {
          setVerificationMessage('Verifique seu email para continuar.')
        }
        return
      }
      if (err?.status === 503) {
        addToast('error', 'Serviço de email indisponível', err?.message)
        return
      }
      addToast('error', 'Falha na autenticação', 'Verifique suas credenciais e tente novamente.')
    }
  }

  if (verificationEmail) {
    return (
      <div className="space-y-5">
        <div className="bg-primary/5 border border-primary/10 rounded-xl px-4 py-3 flex items-start gap-3">
          <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-text">Verifique seu email</p>
            <p className="text-xs text-gray-500 mt-1">
              Para acessar o sistema, confirme que <strong>{verificationEmail}</strong> é o seu
              email. Digite o código de 6 dígitos enviado para você.
            </p>
          </div>
        </div>

        {verificationMessage && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{verificationMessage}</p>
        )}

        <Input
          label="Código de verificação"
          placeholder="6 dígitos"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
            if (codeError) setCodeError('')
          }}
          error={codeError || undefined}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
        />

        <div className="flex flex-col gap-3">
          <Button
            icon={<ShieldCheck className="h-4 w-4" />}
            loading={confirming}
            disabled={code.trim().length !== 6}
            onClick={handleConfirmCode}
            fullWidth
            size="lg"
          >
            Confirmar e entrar
          </Button>
          <Button
            variant="secondary"
            fullWidth
            loading={sendingCode}
            disabled={resendCooldown > 0}
            icon={<RotateCcw className="h-4 w-4" />}
            onClick={() => void handleSendCode(verificationEmail)}
          >
            {resendCooldown > 0 ? `Reenviar código (${resendCooldown}s)` : 'Reenviar código'}
          </Button>
          <button
            type="button"
            onClick={() => {
              setVerificationEmail(null)
              setCode('')
              setCodeError('')
              setVerificationMessage('')
            }}
            className="inline-flex items-center justify-center gap-2 text-sm font-medium text-gray-500 hover:text-text transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao login
          </button>
        </div>
      </div>
    )
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
