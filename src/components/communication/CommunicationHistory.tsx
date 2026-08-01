import { motion } from 'framer-motion'
import { messageHistoryService } from '../../services/messageHistoryService'
import {
  Send, Edit3, Clock, XCircle, AlertTriangle, History
} from 'lucide-react'

interface CommunicationHistoryProps {
  messageId?: string
  compact?: boolean
}

const actionConfig: Record<string, { icon: typeof Send; color: string; label: string }> = {
  created: { icon: Edit3, color: 'text-primary', label: 'Criada' },
  edited: { icon: Edit3, color: 'text-warning', label: 'Editada' },
  scheduled: { icon: Clock, color: 'text-warning', label: 'Agendada' },
  cancelled: { icon: XCircle, color: 'text-gray-400', label: 'Cancelada' },
  sent: { icon: Send, color: 'text-success', label: 'Enviada' },
  failed: { icon: AlertTriangle, color: 'text-error', label: 'Erro' },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function CommunicationHistory({ messageId, compact = false }: CommunicationHistoryProps) {
  const entries = messageHistoryService.list(messageId)

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2">
        <History className="h-6 w-6 text-gray-300" />
        <p className="text-xs text-gray-400">Nenhum registro no histórico</p>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {entries.slice(0, compact ? 5 : undefined).map((entry, i) => {
        const cfg = actionConfig[entry.action] || actionConfig.created
        const Icon = cfg.icon
        return (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: i * 0.03 }}
            className="relative flex items-start gap-3 pb-4 last:pb-0"
          >
            <div className="flex flex-col items-center">
              <div className={`h-7 w-7 rounded-full ${cfg.color.replace('text', 'bg')}/10 flex items-center justify-center`}>
                <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
              </div>
              {i < entries.length - 1 && (
                <div className="w-px flex-1 bg-gray-100 dark:bg-gray-800 mt-1" />
              )}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-xs font-medium text-text">{cfg.label}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{entry.description}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(entry.timestamp)}</p>
            </div>
          </motion.div>
        )
      })}
      {compact && entries.length > 5 && (
        <p className="text-[10px] text-center text-gray-400 pt-2">
          +{entries.length - 5} registro(s)
        </p>
      )}
    </div>
  )
}
