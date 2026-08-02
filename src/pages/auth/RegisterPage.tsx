import { useState } from 'react'
import { Navigate, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { PasswordInput } from '../../components/auth/PasswordInput'
import { Button } from '../../components/ui/Button'
import { UserPlus, ArrowRight, ArrowLeft, MapPin, CalendarClock, Wallet } from 'lucide-react'
import {
  validateEmail,
  validateNewPassword,
  validateConfirmPassword,
  getPasswordStrength,
} from '../../validators/authValidators'
import { isValidCPF, formatCPF, formatPhone } from '../../validators/passengerValidators'
import { validatePhone } from '../../utils/validators'
import type { RegisterCredentials } from '../../types/auth'

const transportOptions = [
  { value: 'university', label: 'Estudante' },
  { value: 'contract', label: 'Trabalho / Contrato' },
]

interface RegisterErrors {
  name?: string
  email?: string
  cpf?: string
  phone?: string
  password?: string
  confirmPassword?: string
  pickupPoint?: string
  destination?: string
  contractStartDate?: string
  monthlyFee?: string
}

export function RegisterPage() {
  const { register, isAuthenticated, isLoading, error } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [form, setForm] = useState<RegisterCredentials>({
    name: '',
    email: '',
    cpf: '',
    phone: '',
    password: '',
    transportType: 'university',
    pickupPoint: '',
    destination: '',
    contractStartDate: '',
    monthlyFee: '',
  })
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<RegisterErrors>({})

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  const handleChange = (field: keyof RegisterCredentials, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field as keyof RegisterErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const validateStep1 = (): boolean => {
    const nextErrors: RegisterErrors = {}
    if (form.name.trim().length < 3) nextErrors.name = 'Informe seu nome completo'
    if (!validateEmail(form.email)) nextErrors.email = 'Informe um email válido'
    if (!isValidCPF(form.cpf)) nextErrors.cpf = 'Informe um CPF válido'
    if (!validatePhone(form.phone)) nextErrors.phone = 'Informe um telefone com DDD'
    const passwordResult = validateNewPassword(form.password)
    if (!passwordResult.valid) nextErrors.password = passwordResult.error
    const confirmResult = validateConfirmPassword(form.password, confirmPassword)
    if (!confirmResult.valid) nextErrors.confirmPassword = confirmResult.error

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const validateStep2 = (): boolean => {
    const nextErrors: RegisterErrors = {}
    if (!form.pickupPoint.trim()) nextErrors.pickupPoint = 'Informe o ponto de saída'
    if (!form.destination.trim()) nextErrors.destination = 'Informe o destino'
    if (!form.contractStartDate) nextErrors.contractStartDate = 'Informe a data de início'
    const feeValue = Number(String(form.monthlyFee).replace(',', '.'))
    if (!form.monthlyFee || !Number.isFinite(feeValue) || feeValue <= 0) {
      nextErrors.monthlyFee = 'Informe o valor da mensalidade'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep1()) setStep(2)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateStep1() || !validateStep2()) return

    try {
      await register(form)
      addToast('success', 'Conta criada com sucesso!')
      navigate('/', { replace: true })
    } catch (err: any) {
      if (err?.code === 'EMAIL_NOT_VERIFIED') {
        addToast('success', 'Conta criada!', 'Verifique seu email para acessar o sistema.')
        navigate('/login', { replace: true, state: { verifyEmail: err.email } })
        return
      }
      addToast('error', 'Não foi possível criar a conta')
    }
  }

  const strength = getPasswordStrength(form.password)
  const formatBRDate = (iso: string): string => {
    if (!iso) return ''
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }
  const firstDueDateLabel = (() => {
    if (!form.contractStartDate) return '-'
    const [y, m, d] = form.contractStartDate.split('-').map(Number)
    let nextMonth = m + 1
    let nextYear = y
    if (nextMonth > 12) { nextMonth = 1; nextYear++ }
    return `${String(d).padStart(2, '0')}/${String(nextMonth).padStart(2, '0')}/${nextYear}`
  })()

  return (
    <AuthLayout
      title="Criar conta"
      subtitle={step === 1 ? 'Etapa 1 de 2: seus dados pessoais' : 'Etapa 2 de 2: dados do contrato'}
    >
      <div className="flex items-center gap-2 mb-6">
        <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`} />
        <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {step === 1 && (
          <>
            <Input
              label="Nome completo"
              placeholder="Digite seu nome completo"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              error={errors.name}
              autoComplete="name"
              autoFocus
            />

            <Input
              label="Email"
              type="email"
              placeholder="Digite seu email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              error={errors.email}
              autoComplete="email"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="CPF"
                placeholder="000.000.000-00"
                value={form.cpf}
                onChange={(e) => handleChange('cpf', formatCPF(e.target.value))}
                error={errors.cpf}
                autoComplete="off"
                inputMode="numeric"
              />
              <Input
                label="Telefone"
                placeholder="(00) 00000-0000"
                value={form.phone}
                onChange={(e) => handleChange('phone', formatPhone(e.target.value))}
                error={errors.phone}
                autoComplete="tel"
                inputMode="tel"
              />
            </div>

            <PasswordInput
              label="Senha"
              placeholder="Crie uma senha forte"
              value={form.password}
              onChange={(e) => handleChange('password', e.target.value)}
              error={errors.password}
              autoComplete="new-password"
            />

            {form.password && (
              <p className="text-xs font-medium -mt-2" style={{ color: strength.color }}>
                Força da senha: {strength.label}
              </p>
            )}

            <PasswordInput
              label="Confirmar senha"
              placeholder="Repita a senha"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                if (errors.confirmPassword) {
                  setErrors((prev) => ({ ...prev, confirmPassword: undefined }))
                }
              }}
              error={errors.confirmPassword}
              autoComplete="new-password"
            />

            <Button
              type="button"
              fullWidth
              size="lg"
              icon={<ArrowRight className="h-4 w-4" />}
              onClick={handleNext}
            >
              Continuar
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-sm">
              <p className="text-gray-500 dark:text-gray-400">Conta para</p>
              <p className="font-semibold text-text">{form.name}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{form.email}</p>
            </div>

            <Select
              label="Tipo de contrato"
              options={transportOptions}
              value={form.transportType}
              onChange={(e) => handleChange('transportType', e.target.value)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Ponto de saída"
                placeholder="Ex.: Terminal Central"
                value={form.pickupPoint}
                onChange={(e) => handleChange('pickupPoint', e.target.value)}
                error={errors.pickupPoint}
                icon={<MapPin className="h-4 w-4" />}
              />
              <Input
                label="Destino"
                placeholder="Ex.: USP - Cidade Universitária"
                value={form.destination}
                onChange={(e) => handleChange('destination', e.target.value)}
                error={errors.destination}
                icon={<MapPin className="h-4 w-4" />}
              />
            </div>

            <Input
              label="Data de início do contrato"
              type="date"
              value={form.contractStartDate}
              onChange={(e) => handleChange('contractStartDate', e.target.value)}
              error={errors.contractStartDate}
              icon={<CalendarClock className="h-4 w-4" />}
            />

            <Input
              label="Valor da mensalidade (R$)"
              type="number"
              step="0.01"
              min="0"
              placeholder="Ex.: 189,90"
              value={form.monthlyFee}
              onChange={(e) => handleChange('monthlyFee', e.target.value)}
              error={errors.monthlyFee}
              icon={<Wallet className="h-4 w-4" />}
            />

            <div className="bg-primary/5 border border-primary/10 rounded-xl px-4 py-3 flex items-start gap-2">
              <CalendarClock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-gray-600 dark:text-gray-300">
                {form.contractStartDate ? (
                  <>
                    Contrato iniciando em <strong className="text-text">{formatBRDate(form.contractStartDate)}</strong>.
                    Sua primeira mensalidade vencerá 1 mês após o início, em{' '}
                    <strong className="text-text">{firstDueDateLabel}</strong>, e depois todo dia{' '}
                    <strong className="text-text">{Number(form.contractStartDate.slice(8, 10))}</strong> de cada mês.
                  </>
                ) : (
                  <>A data de início define o dia de vencimento da mensalidade todo mês.</>
                )}
              </p>
            </div>

            {error && (
              <div className="bg-error/5 border border-error/20 rounded-xl px-4 py-3" role="alert">
                <p className="text-sm text-error font-medium">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                icon={<ArrowLeft className="h-4 w-4" />}
                onClick={() => setStep(1)}
              >
                Voltar
              </Button>
              <Button
                type="submit"
                size="lg"
                loading={isLoading}
                icon={<UserPlus className="h-4 w-4" />}
              >
                Criar conta
              </Button>
            </div>
          </>
        )}

        <div className="text-center">
          <span className="text-sm text-gray-500 dark:text-gray-400">Já tem uma conta? </span>
          <Link
            to="/login"
            className="text-sm font-medium text-primary hover:text-primary-light transition-colors"
          >
            Entrar
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}
