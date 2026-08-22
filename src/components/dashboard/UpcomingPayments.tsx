import { Card } from '../ui/Card'
import { SectionTitle } from './SectionTitle'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import type { UpcomingPayment } from '../../types/dashboard'

interface UpcomingPaymentsProps {
  payments: UpcomingPayment[]
}

export function UpcomingPayments({ payments }: UpcomingPaymentsProps) {
  return (
    <Card>
      <SectionTitle
        title="Próximos vencimentos"
        action={
          <Button variant="ghost" size="sm">
            Ver todos
          </Button>
        }
      />
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {payments.map((payment) => (
          <li key={payment.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <div className="h-8 w-8 rounded-full bg-primary-soft text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
              {payment.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text truncate">{payment.name}</p>
              <p className="text-xs text-gray-400">
                Vence {payment.dueDate} •{' '}
                {payment.daysRemaining < 0
                  ? `${Math.abs(payment.daysRemaining)} ${
                      Math.abs(payment.daysRemaining) === 1 ? 'dia' : 'dias'
                    } em atraso`
                  : payment.daysRemaining === 0
                  ? 'Hoje'
                  : `${payment.daysRemaining} dias`}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-text tabular-nums">
                R$ {payment.value.toFixed(2).replace('.', ',')}
              </p>
              <Badge
                variant={
                  payment.daysRemaining < 0
                    ? 'error'
                    : payment.daysRemaining <= 3
                    ? 'error'
                    : payment.daysRemaining <= 7
                    ? 'warning'
                    : 'neutral'
                }
              >
                {payment.daysRemaining < 0
                  ? `Vencida há ${Math.abs(payment.daysRemaining)}d`
                  : payment.daysRemaining === 0
                  ? 'Vence hoje'
                  : `${payment.daysRemaining}d`}
              </Badge>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}