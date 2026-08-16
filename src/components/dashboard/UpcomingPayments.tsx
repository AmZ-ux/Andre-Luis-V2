import { motion } from 'framer-motion'
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
    >
      <Card>
        <SectionTitle
          title="Próximos Vencimentos"
          action={
            <Button variant="ghost" size="sm">
              Ver todos
            </Button>
          }
        />
        <div className="space-y-2">
          {payments.map((payment) => (
            <div
              key={payment.id}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="h-9 w-9 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                {payment.initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text">{payment.name}</p>
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
                <p className="text-sm font-semibold text-text">
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
            </div>
          ))}
        </div>
      </Card>
    </motion.div>
  )
}
