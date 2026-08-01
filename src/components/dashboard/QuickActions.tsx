import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { SectionTitle } from './SectionTitle'
import { UserPlus, Wallet, BarChart3, Search } from 'lucide-react'

export function QuickActions() {
  const navigate = useNavigate()

  const actions = [
    { label: 'Cadastrar Passageiro', icon: UserPlus, path: '/passageiros', variant: 'primary' as const },
    { label: 'Nova Mensalidade', icon: Wallet, path: '/mensalidades', variant: 'secondary' as const },
    { label: 'Relatórios', icon: BarChart3, path: '/?tab=relatorios', variant: 'secondary' as const },
    { label: 'Pesquisar Passageiro', icon: Search, path: '/passageiros', variant: 'secondary' as const },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
    >
      <Card>
        <SectionTitle title="Ações Rápidas" />
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => {
            const Icon = action.icon
            return (
              <Button
                key={action.label}
                variant={action.variant}
                onClick={() => navigate(action.path)}
                icon={<Icon className="h-4 w-4 shrink-0" />}
                className="justify-start"
                size="sm"
              >
                <span className="truncate">{action.label}</span>
              </Button>
            )
          })}
        </div>
      </Card>
    </motion.div>
  )
}
