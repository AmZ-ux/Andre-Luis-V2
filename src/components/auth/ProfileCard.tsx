import type { User } from '../../types/auth'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { UserAvatar } from './UserAvatar'
import { getRoleLabel } from '../../constants/permissions'
import { Mail, Phone, CreditCard, Calendar, Clock } from 'lucide-react'

interface ProfileCardProps {
  user: User
}

export function ProfileCard({ user }: ProfileCardProps) {
  const infoItems = [
    { icon: Mail, label: 'Email', value: user.email },
    { icon: Phone, label: 'Telefone', value: user.phone },
    { icon: CreditCard, label: 'CPF', value: user.cpf },
    { icon: Calendar, label: 'Cadastro', value: user.createdAt },
    { icon: Clock, label: 'Último acesso', value: user.lastAccess },
  ]

  return (
    <Card>
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 mb-6">
        <UserAvatar user={user} size="lg" showName={false} />
        <div className="text-center sm:text-left">
          <h2 className="text-lg font-bold text-text">{user.name}</h2>
          <Badge variant="primary" className="mt-1">
            {getRoleLabel(user.role)}
          </Badge>
        </div>
      </div>

      <div className="space-y-3">
        {infoItems.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.label}
              className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50"
            >
              <Icon className="h-4 w-4 text-gray-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
                <p className="text-sm font-medium text-text truncate">{item.value}</p>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
