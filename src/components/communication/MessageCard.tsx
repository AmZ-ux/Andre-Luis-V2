import { motion } from 'framer-motion'
import { cn } from '../../utils/cn'
import type { CommunicationMessage } from '../../types/communication'
import { Clock, Send, AlertTriangle, XCircle, CheckCircle, MessageSquare } from 'lucide-react'

interface MessageCardProps {
  message: CommunicationMessage
  onClick?: () => void
}

const statusConfig: Record<string, { icon: typeof Send; color: string; bg: string; label: string }> = {
  sent: { icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', label: 'Enviada' },
  draft: { icon: MessageSquare, color: 'text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800', label: 'Rascunho' },
  scheduled: { icon: Clock, color: 'text-warning', bg: 'bg-warning/10', label: 'Agendada' },
  failed: { icon: AlertTriangle, color: 'text-error', bg: 'bg-error/10', label: 'Erro' },
  cancelled: { icon: XCircle, color: 'text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800', label: 'Cancelada' },
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function MessageCard({ message, onClick }: MessageCardProps) {
  const cfg = statusConfig[message.status] || statusConfig.draft
  const StatusIcon = cfg.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className="group bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('h-2 w-2 rounded-full', cfg.color.replace('text-', 'bg-'))} />
            <p className="text-sm font-medium text-text truncate">{message.title}</p>
          </div>
          <p className="text-xs text-gray-500 line-clamp-2">{message.body}</p>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium', cfg.bg, cfg.color)}>
              <StatusIcon className="h-3 w-3" />
              {cfg.label}
            </span>
            <span className="text-[10px] text-gray-400">{formatDate(message.createdAt)}</span>
            {message.recipients.length > 0 && (
              <span className="text-[10px] text-gray-400">{message.recipients.length} destinatário(s)</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
