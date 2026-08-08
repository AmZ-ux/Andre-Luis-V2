import { useState, useEffect } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { monthlyFeeService } from '../../services/monthlyFeeService'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { PageSpinner } from '../../components/ui/Spinner'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ThemeCustomizer } from '../../components/settings/ThemeCustomizer'
import { useNavigate } from 'react-router-dom'
import { useInstallPrompt } from '../../hooks/useInstallPrompt'
import { useToast } from '../../contexts/ToastContext'
import { useSettings } from '../../hooks/useSettings'
import { UserAvatar } from '../../components/auth/UserAvatar'
import { getRoleLabel } from '../../constants/permissions'
import {
  Lock, LogOut, Pencil, X, Check, Mail, Phone, CreditCard, Calendar, Clock,
  Download, ShieldCheck, ShieldAlert, KeyRound, UserMinus, CheckCircle2,
} from 'lucide-react'
import { formatPhone } from '../../validators/passengerValidators'
import { validatePhone } from '../../utils/validators'

export function ProfilePage() {
  const {
    user, isLoading, logout, updateProfile, sendVerificationEmail, confirmVerificationEmail, endContract,
  } = useAuth()
  const { canInstall, install } = useInstallPrompt()
  const { addToast } = useToast()
  const { settings, updateCategory, saved } = useSettings()
  const navigate = useNavigate()

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [errors, setErrors] = useState<{ name?: string; email?: string; phone?: string }>({})
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [showEndContract, setShowEndContract] = useState(false)
  const [endingContract, setEndingContract] = useState(false)
  const [demoCode, setDemoCode] = useState<string | undefined>(undefined)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [openFees, setOpenFees] = useState(0)

  useEffect(() => {
    if (user?.role !== 'passenger') return
    monthlyFeeService
      .getByPassengerId(user.id)
      .then((fees) => setOpenFees(fees.filter((f) => f.status === 'pending' || f.status === 'overdue').length))
      .catch(() => {})
  }, [user])

  if (isLoading || !user) {
    return <PageSpinner />
  }

  const startEdit = () => {
    setForm({ name: user.name, email: user.email, phone: user.phone })
    setErrors({})
    setEditing(true)
  }

  const handleSave = async () => {
    const nextErrors: typeof errors = {}
    if (form.name.trim().length < 3) nextErrors.name = 'Informe seu nome completo'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) nextErrors.email = 'Informe um email válido'
    if (!validatePhone(form.phone)) nextErrors.phone = 'Informe um telefone com DDD'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    try {
      await updateProfile({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
      })
      addToast('success', 'Perfil atualizado!')
      setEditing(false)
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao atualizar perfil')
    } finally {
      setSaving(false)
    }
  }

  const handleSendCode = async () => {
    setVerifying(true)
    setCodeError(null)
    setCode('')
    try {
      const result = await sendVerificationEmail()
      setCodeSent(true)
      setDemoCode(result.demoCode)
      addToast('success', 'Código enviado para seu email!')
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao enviar código')
    } finally {
      setVerifying(false)
    }
  }

  const handleConfirmCode = async () => {
    if (code.trim().length !== 6) {
      setCodeError('Informe o código de 6 dígitos')
      return
    }
    setConfirming(true)
    setCodeError(null)
    try {
      await confirmVerificationEmail(code.trim())
      addToast('success', 'Email verificado com sucesso!')
      setCodeSent(false)
      setDemoCode(undefined)
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : 'Código incorreto')
    } finally {
      setConfirming(false)
    }
  }

  const handleEndContract = async () => {
    setEndingContract(true)
    try {
      await endContract()
      addToast('success', 'Contrato encerrado! A administração foi notificada.')
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao encerrar contrato')
    } finally {
      setEndingContract(false)
    }
  }

  const infoItems = [
    { icon: Mail, label: 'Email', value: user.email, verified: user.emailVerified },
    { icon: Phone, label: 'Telefone', value: user.phone },
    { icon: CreditCard, label: 'CPF', value: user.cpf },
    { icon: Calendar, label: 'Cadastro', value: user.createdAt },
    { icon: Clock, label: 'Último acesso', value: user.lastAccess },
  ]

  return (
    <div className="space-y-6 sm:space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-text">Meu Perfil</h1>
        <p className="text-sm text-gray-500 mt-1">Suas informações pessoais e preferências</p>
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 mb-6">
          <UserAvatar user={user} size="lg" showName={false} />
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-lg font-bold text-text">{user.name}</h2>
            <Badge variant="primary" className="mt-1">
              {user.superAdmin ? 'Super Admin' : getRoleLabel(user.role)}
            </Badge>
            <div className="mt-1">
              {user.emailVerified ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                  <ShieldCheck className="h-3.5 w-3.5" /> Email verificado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-dark dark:text-warning">
                  <ShieldAlert className="h-3.5 w-3.5" /> Email não verificado
                </span>
              )}
            </div>
          </div>
          {!editing && (
            <Button variant="secondary" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={startEdit}>
              Editar
            </Button>
          )}
        </div>

        {editing ? (
          <div className="space-y-4">
            <Input
              label="Nome completo"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              error={errors.name}
              autoFocus
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              error={errors.email}
            />
            <Input
              label="Telefone"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: formatPhone(e.target.value) }))}
              error={errors.phone}
              inputMode="tel"
            />
            <div className="flex gap-3 justify-end">
              <Button
                variant="secondary"
                icon={<X className="h-4 w-4" />}
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button icon={<Check className="h-4 w-4" />} loading={saving} onClick={handleSave}>
                Salvar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {infoItems.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50"
                >
                  <Icon className="h-4 w-4 text-gray-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
                    <p className="text-sm font-medium text-text truncate">{item.value}</p>
                  </div>
                  {item.verified !== undefined &&
                    (item.verified ? (
                      <ShieldCheck className="h-4 w-4 text-success shrink-0" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 text-warning shrink-0" />
                    ))}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {!user.emailVerified && !editing && (
        <Card>
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-2xl bg-warning/10 flex items-center justify-center shrink-0">
              <KeyRound className="h-5 w-5 text-warning" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-text mb-1">Verificar email (recomendado)</h2>
              <p className="text-xs text-gray-500 mb-3">
                Confirmar seu email é opcional, mas ajuda a proteger sua conta e a receber
                comunicações importantes. Você pode fazer isso a qualquer momento.
              </p>
              {codeSent ? (
                <div className="space-y-3">
                  {demoCode && (
                    <div className="bg-primary/5 border border-primary/10 rounded-xl px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                      <strong className="text-text">Modo demonstração:</strong> como o envio real de email só
                      funciona com a API configurada, seu código é{' '}
                      <strong className="text-primary">{demoCode}</strong>
                    </div>
                  )}
                  <Input
                    label="Código de verificação"
                    placeholder="6 dígitos"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    error={codeError || undefined}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      loading={verifying}
                      onClick={() => { setCodeSent(false); setDemoCode(undefined) }}
                    >
                      Voltar
                    </Button>
                    <Button
                      icon={<ShieldCheck className="h-4 w-4" />}
                      loading={confirming}
                      disabled={code.trim().length !== 6}
                      onClick={handleConfirmCode}
                    >
                      Confirmar código
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Mail className="h-4 w-4" />}
                  loading={verifying}
                  onClick={handleSendCode}
                >
                  Enviar código de verificação
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="text-base font-semibold text-text mb-4">Aparência</h2>
        <ThemeCustomizer
          settings={settings.appearance}
          onSave={(v) => updateCategory('appearance', v, user.name)}
          saved={saved}
        />
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-text mb-4">Ações</h2>
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <Button
            variant="secondary"
            icon={<Lock className="h-4 w-4" />}
            onClick={() => navigate('/alterar-senha')}
          >
            Alterar senha
          </Button>
          {canInstall && (
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={install}>
              Instalar aplicativo
            </Button>
          )}
          {user.role === 'passenger' &&
            (user.contractStatus === 'inactive' ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success py-2">
                <CheckCircle2 className="h-4 w-4" /> Seu contrato está encerrado
              </span>
            ) : (
              <Button
                variant="danger"
                icon={<UserMinus className="h-4 w-4" />}
                onClick={() => {
                  if (openFees > 0) {
                    addToast('error', openFees === 1
                      ? 'Você possui 1 mensalidade em aberto. Regularize o pagamento antes de encerrar o contrato.'
                      : `Você possui ${openFees} mensalidades em aberto. Regularize os pagamentos antes de encerrar o contrato.`)
                    return
                  }
                  setShowEndContract(true)
                }}
              >
                Encerrar contrato
              </Button>
            ))}
          <Button variant="ghost" icon={<LogOut className="h-4 w-4" />} onClick={logout}>
            Sair da conta
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={showEndContract}
        onClose={() => setShowEndContract(false)}
        onConfirm={handleEndContract}
        title="Encerrar contrato"
        message="Tem certeza? Seu contrato será encerrado e a administração será notificada. Esta ação não pode ser desfeita."
        confirmLabel={endingContract ? 'Encerrando...' : 'Encerrar contrato'}
        variant="danger"
      />
    </div>
  )
}
