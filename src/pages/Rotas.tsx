import { useState } from 'react'
import { MapPin, Plus, Pencil, PowerOff, RefreshCw, AlertTriangle } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { SkeletonTable } from '../components/ui/Skeleton'
import { useRoutes } from '../hooks/useRoutes'
import { RouteFormModal } from '../components/routes/RouteFormModal'
import type { Route, RouteFormData } from '../types/route'
import { useToast } from '../contexts/ToastContext'

function formatCurrency(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}

export function Rotas() {
  const { routes, loading, error, showInactive, toggleShowInactive, createRoute, updateRoute, deactivateRoute, reload } = useRoutes()
  const { addToast } = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [editingRoute, setEditingRoute] = useState<Route | null>(null)
  const [deactivatingRoute, setDeactivatingRoute] = useState<Route | null>(null)

  const handleCreate = async (data: RouteFormData) => {
    await createRoute(data.origin, data.destination, data.monthlyAmount)
    addToast('success', 'Rota criada com sucesso!')
  }

  const handleEdit = async (data: RouteFormData) => {
    if (!editingRoute) return
    await updateRoute(editingRoute.id, data)
    addToast('success', 'Rota atualizada!')
    setEditingRoute(null)
  }

  const handleDeactivate = async () => {
    if (!deactivatingRoute) return
    try {
      await deactivateRoute(deactivatingRoute.id)
      addToast('success', 'Rota desativada.')
    } catch {
      addToast('error', 'Não foi possível desativar a rota.')
    }
    setDeactivatingRoute(null)
  }

  if (loading) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <PageHeader className="hidden sm:block" eyebrow="Operação" title="Rotas e Valores" subtitle="Configure os trajetos disponíveis e o valor mensal correspondente" />
        <SkeletonTable />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <PageHeader className="hidden sm:block" eyebrow="Operação" title="Rotas e Valores" subtitle="Configure os trajetos disponíveis e o valor mensal correspondente" />
        <Card>
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="h-12 w-12 rounded-full bg-error-soft flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-error" />
            </div>
            <p className="text-sm text-gray-500">{error}</p>
            <Button variant="secondary" onClick={() => void reload()}>
              Tentar novamente
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        className="hidden sm:block"
        eyebrow="Operação"
        title="Rotas e Valores"
        subtitle="Configure os trajetos disponíveis e o valor mensal correspondente"
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setFormOpen(true)}>
            Nova rota
          </Button>
        }
      />

      <div className="flex items-center justify-between gap-3 sm:hidden">
        <h1 className="text-lg font-bold text-text">Rotas e Valores</h1>
        <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setFormOpen(true)}>
          Nova
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant={showInactive ? 'primary' : 'secondary'}
          size="sm"
          icon={<RefreshCw className="h-3.5 w-3.5" />}
          onClick={toggleShowInactive}
        >
          {showInactive ? 'Mostrar apenas ativas' : 'Mostrar todas'}
        </Button>
        <span className="text-xs text-gray-500">
          {routes.length} {routes.length === 1 ? 'rota' : 'rotas'}
        </span>
      </div>

      {routes.length === 0 ? (
        <Card>
          <EmptyState
            icon={<MapPin className="h-6 w-6 text-gray-400" />}
            title={showInactive ? 'Nenhuma rota encontrada' : 'Você ainda não cadastrou nenhuma rota'}
            description={showInactive ? 'Tente ajustar os filtros.' : 'Cadastre o primeiro trajeto para começar a configurar os valores das mensalidades.'}
            actionLabel={showInactive ? undefined : 'Cadastrar rota'}
            onAction={showInactive ? undefined : () => setFormOpen(true)}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {routes.map((route) => (
            <Card key={route.id} className="p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <MapPin className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-text">{route.origin}</p>
                      <span className="text-gray-400">→</span>
                      <p className="text-sm font-semibold text-text">{route.destination}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-10">
                    <p className="text-base font-bold text-primary">{formatCurrency(route.monthlyAmount)}</p>
                    <Badge variant={route.active ? 'success' : 'neutral'} dot>
                      {route.active ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2 ml-10 sm:ml-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={() => setEditingRoute(route)}
                  >
                    Editar
                  </Button>
                  {route.active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<PowerOff className="h-3.5 w-3.5" />}
                      onClick={() => setDeactivatingRoute(route)}
                      className="text-error hover:text-error hover:bg-error/5"
                    >
                      Desativar
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <RouteFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleCreate}
      />

      <RouteFormModal
        isOpen={!!editingRoute}
        onClose={() => setEditingRoute(null)}
        onSave={handleEdit}
        editRoute={editingRoute}
      />

      <ConfirmDialog
        open={!!deactivatingRoute}
        onClose={() => setDeactivatingRoute(null)}
        onConfirm={handleDeactivate}
        title="Desativar rota"
        message="Novos passageiros não poderão selecionar esta rota. Os dados existentes serão preservados."
        confirmLabel="Desativar"
        variant="warning"
      />
    </div>
  )
}
