import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { PasswordInput } from '../auth/PasswordInput'
import { Badge } from '../ui/Badge'
import { PageSpinner } from '../ui/Spinner'
import { UserPlus, ShieldCheck, ShieldX, Crown, UserCog, RefreshCw, AlertTriangle } from 'lucide-react'
import { adminService, type AdminUser } from '../../services/adminService'
import { validateEmail } from '../../validators/authValidators'

export function AdminsManager() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const isSuperAdmin = user?.superAdmin === true

  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [demotingId, setDemotingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [formErrors, setFormErrors] = useState<{ name?: string; email?: string; password?: string }>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      setAdmins(await adminService.list())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!isSuperAdmin) {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <ShieldX className="h-5 w-5 text-warning mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-text">Acesso restrito</p>
            <p className="text-xs text-gray-500 mt-1">
              Apenas o super administrador pode gerenciar contas de administrador.
            </p>
          </div>
        </div>
      </Card>
    )
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()

    const errors: typeof formErrors = {}
    const emailCheck = validateEmail(form.email)
    if (!emailCheck.valid) errors.email = emailCheck.error
    if (form.password.length < 8) errors.password = 'Mínimo de 8 caracteres'
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    setCreating(true)
    try {
      await adminService.create({ name: form.name.trim() || 'Administrador', email: form.email.trim(), password: form.password })
      addToast('success', 'Administrador criado!', 'Envie o e-mail e a senha para o responsável — ele já entra como administrador.')
      setForm({ name: '', email: '', password: '' })
      setShowCreate(false)
      await load()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar administrador'
      addToast('error', 'Não foi possível criar', message)
    } finally {
      setCreating(false)
    }
  }

  const handleDemote = async (admin: AdminUser) => {
    if (admin.superAdmin) return
    setDemotingId(admin.id)
    try {
      await adminService.demote(admin.id)
      addToast('success', `${admin.name} voltou a ser passageiro.`)
      await load()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao rebaixar'
      addToast('error', 'Não foi possível rebaixar', message)
    } finally {
      setDemotingId(null)
    }
  }

  if (loading) return <PageSpinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm text-gray-500">
            {admins.length} {admins.length === 1 ? 'administrador cadastrado' : 'administradores cadastrados'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<RefreshCw className="h-4 w-4" />} onClick={() => void load()}>
            Atualizar
          </Button>
          {!showCreate && (
            <Button size="sm" icon={<UserPlus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>
              Novo administrador
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-error/5 border border-error/20 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-error mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-error font-medium">Não foi possível carregar os administradores</p>
            <Button variant="secondary" size="sm" className="mt-2" onClick={() => void load()}>
              Tentar novamente
            </Button>
          </div>
        </div>
      )}

      {showCreate && (
        <Card>
          <h3 className="text-sm font-semibold text-text mb-1">Criar conta de administrador</h3>
          <p className="text-xs text-gray-500 mb-4">
            Cadastre as credenciais (e-mail e senha) do responsável do transporte (ex.: o André
            Luis). Ele já entra direto como administrador — sem precisar se cadastrar como passageiro.
          </p>
          <form onSubmit={handleCreate} className="space-y-4">
            <Input
              label="Nome completo"
              placeholder="Opcional — ex.: André Luis"
              value={form.name}
              onChange={(e) => {
                setForm((p) => ({ ...p, name: e.target.value }))
                if (formErrors.name) setFormErrors((p) => ({ ...p, name: undefined }))
              }}
              error={formErrors.name}
            />
            <Input
              label="Email"
              type="email"
              placeholder="email@exemplo.com"
              value={form.email}
              onChange={(e) => {
                setForm((p) => ({ ...p, email: e.target.value }))
                if (formErrors.email) setFormErrors((p) => ({ ...p, email: undefined }))
              }}
              error={formErrors.email}
            />
            <PasswordInput
              label="Senha"
              placeholder="Mínimo de 8 caracteres"
              value={form.password}
              onChange={(e) => {
                setForm((p) => ({ ...p, password: e.target.value }))
                if (formErrors.password) setFormErrors((p) => ({ ...p, password: undefined }))
              }}
              error={formErrors.password}
              autoComplete="new-password"
            />
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={creating} icon={<UserCog className="h-4 w-4" />}>
                Criar administrador
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="space-y-2">
        {admins.map((admin) => (
          <Card key={admin.id} className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${admin.superAdmin ? 'bg-primary/10' : 'bg-gray-100 dark:bg-gray-800'}`}>
                {admin.superAdmin ? (
                  <Crown className="h-5 w-5 text-primary" />
                ) : (
                  <ShieldCheck className="h-5 w-5 text-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-text truncate">{admin.name}</p>
                  {admin.superAdmin && (
                    <Badge className="bg-primary/10 text-primary">Super Admin</Badge>
                  )}
                  {!admin.emailVerified && (
                    <Badge className="bg-warning/10 text-warning">Email não verificado</Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate">{admin.email}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Último acesso: {admin.lastAccess || 'nunca'}
                </p>
              </div>
              {!admin.superAdmin && (
                <Button
                  variant="danger"
                  size="sm"
                  loading={demotingId === admin.id}
                  onClick={() => void handleDemote(admin)}
                >
                  Rebaixar
                </Button>
              )}
            </div>
          </Card>
        ))}
        {!loading && !error && admins.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-8">
            Nenhum administrador cadastrado ainda.
          </p>
        )}
      </div>
    </div>
  )
}
