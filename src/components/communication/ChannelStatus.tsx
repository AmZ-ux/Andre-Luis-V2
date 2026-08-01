import { motion } from 'framer-motion'
import { cn } from '../../utils/cn'
import {
  Smartphone, MessageCircle, Mail, MessageSquare, Bell,
} from 'lucide-react'
import type { Channel, ChannelType } from '../../types/communication'

interface ChannelStatusProps {
  channels: Channel[]
  onToggle: (type: ChannelType, enabled: boolean) => void
}

const iconMap: Record<ChannelType, typeof Smartphone> = {
  app: Smartphone, whatsapp: MessageCircle, email: Mail, sms: MessageSquare, push: Bell,
}

const statusColors: Record<string, { dot: string; bg: string }> = {
  connected: { dot: 'bg-success', bg: 'bg-success/10' },
  disconnected: { dot: 'bg-gray-400', bg: 'bg-gray-100 dark:bg-gray-800' },
  configuring: { dot: 'bg-warning', bg: 'bg-warning/10' },
  error: { dot: 'bg-error', bg: 'bg-error/10' },
}

const statusLabels: Record<string, string> = {
  connected: 'Conectado',
  disconnected: 'Desconectado',
  configuring: 'Configurando',
  error: 'Erro',
}

export function ChannelStatus({ channels, onToggle }: ChannelStatusProps) {
  return (
    <div className="space-y-2">
      {channels.map((ch, i) => {
        const Icon = iconMap[ch.type] || Smartphone
        const colors = statusColors[ch.status] || statusColors.disconnected
        return (
          <motion.div
            key={ch.type}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: i * 0.05 }}
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center', colors.bg)}>
              <Icon className={cn('h-4 w-4', statusColors[ch.status]?.dot.replace('bg-', 'text-') || 'text-gray-400')} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text">{ch.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={cn('h-1.5 w-1.5 rounded-full', colors.dot)} />
                <span className="text-[10px] text-gray-500">{statusLabels[ch.status] || ch.status}</span>
              </div>
            </div>
            {ch.configurable && (
              <button
                onClick={() => onToggle(ch.type, !ch.enabled)}
                className={cn(
                  'relative h-5 w-9 rounded-full transition-all duration-300 shrink-0',
                  ch.enabled ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-300',
                    ch.enabled && 'translate-x-4'
                  )}
                />
              </button>
            )}
            {!ch.configurable && (
              <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">Sempre ativo</span>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
