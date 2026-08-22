import { useNavigate } from 'react-router-dom'
import { Card } from '../ui/Card'
import { SectionTitle } from './SectionTitle'
import { UserPlus, Wallet, BarChart3, Search } from 'lucide-react'

export function QuickActions() {
  const navigate = useNavigate()

  const actions = [
    { label: 'Cadastrar Passageiro', icon: UserPlus, path: '/passageiros' },
    { label: 'Nova Mensalidade', icon: Wallet, path: '/mensalidades' },
    { label: 'Relatórios', icon: BarChart3, path: '/?tab=relatorios' },
    { label: 'Pesquisar Passageiro', icon: Search, path: '/passageiros' },
  ]

  return (
    <Card>
      <SectionTitle title="Ações rápidas" />
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <li key={action.label}>
              <button
                type="button"
                onClick={() => navigate(action.path)}
                className="w-full flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 text-sm font-medium text-text hover:text-primary transition-colors text-left"
              >
                <span className="h-7 w-7 rounded-lg bg-primary-soft text-primary flex items-center justify-center shrink-0">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="flex-1 truncate">{action.label}</span>
                <span className="text-gray-300 dark:text-gray-600" aria-hidden="true">
                  ›
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}