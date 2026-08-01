import { Users, SearchX, AlertCircle } from 'lucide-react'
import { Button } from '../ui/Button'

interface EmptyPassengersProps {
  type: 'empty' | 'not-found' | 'error'
  onAction?: () => void
  actionLabel?: string
}

export function EmptyPassengers({ type, onAction, actionLabel }: EmptyPassengersProps) {
  const config = {
    empty: {
      icon: Users,
      title: 'Nenhum passageiro cadastrado',
      desc: 'Clique em "Novo Passageiro" para começar.',
    },
    'not-found': {
      icon: SearchX,
      title: 'Nenhum resultado encontrado',
      desc: 'Tente ajustar sua pesquisa ou limpar os filtros.',
    },
    error: {
      icon: AlertCircle,
      title: 'Erro ao carregar',
      desc: 'Não foi possível carregar a lista de passageiros.',
    },
  }

  const c = config[type]
  const Icon = c.icon

  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-text mb-1">{c.title}</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">{c.desc}</p>
      {onAction && actionLabel && (
        <Button onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  )
}
