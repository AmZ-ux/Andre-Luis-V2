import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { validateEmail } from '../../validators/authValidators'
import { authService } from '../../auth/authService'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const result = validateEmail(email)
    if (!result.valid) {
      setError(result.error!)
      return
    }

    setError('')
    setIsLoading(true)

    try {
      await authService.forgotPassword(email)
      setSent(true)
    } catch {
      setError('Erro ao enviar recuperação. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  if (sent) {
    return (
      <AuthLayout
        title="Email enviado!"
        subtitle="Verifique sua caixa de entrada e siga as instruções"
      >
        <div className="text-center space-y-6">
          <div className="h-16 w-16 rounded-lg bg-success-soft flex items-center justify-center mx-auto">
            <CheckCircle className="h-8 w-8 text-success" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Se o email estiver cadastrado, você receberá um link para redefinir sua senha em
            alguns minutos.
          </p>
          <Link to="/login">
            <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />}>
              Voltar ao login
            </Button>
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Recuperar senha"
      subtitle="Informe seu email para receber o link de recuperação"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Email"
          type="email"
          placeholder="Digite seu email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (error) setError('')
          }}
          icon={<Mail className="h-4 w-4" />}
          error={error}
          autoFocus
        />

        <Button type="submit" fullWidth size="lg" loading={isLoading}>
          Enviar link de recuperação
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
