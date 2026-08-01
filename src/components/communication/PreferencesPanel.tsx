import { motion } from 'framer-motion'
import {
  Bell, BellOff, Volume2, VolumeX, CalendarClock,
  DollarSign, FileCheck, CalendarOff, Settings, Megaphone,
  Check, X,
} from 'lucide-react'
import { cn } from '../../utils/cn'
import type { NotificationPreferences } from '../../types/communication'

interface PreferencesPanelProps {
  preferences: NotificationPreferences
  onUpdate: (prefs: Partial<NotificationPreferences>) => void
}

export function PreferencesPanel({ preferences, onUpdate }: PreferencesPanelProps) {
  const toggle = (key: keyof NotificationPreferences['messageTypes']) => {
    onUpdate({
      messageTypes: {
        ...preferences.messageTypes,
        [key]: !preferences.messageTypes[key],
      },
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <div>
        <h3 className="text-sm font-semibold text-text mb-3">Notificações</h3>
        <div className="space-y-2">
          <ToggleRow
            icon={preferences.enabled ? Bell : BellOff}
            label="Receber notificações"
            description="Ativar ou desativar todas as notificações"
            checked={preferences.enabled}
            onChange={(v) => onUpdate({ enabled: v })}
          />
          <ToggleRow
            icon={preferences.sound ? Volume2 : VolumeX}
            label="Som"
            description="Tocar som ao receber notificação"
            checked={preferences.sound}
            onChange={(v) => onUpdate({ sound: v })}
          />
          <ToggleRow
            icon={CalendarClock}
            label="Lembretes"
            description="Receber lembretes de vencimento"
            checked={preferences.reminders}
            onChange={(v) => onUpdate({ reminders: v })}
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-text mb-3">Tipos de Mensagem</h3>
        <div className="space-y-2">
          <ToggleRow icon={DollarSign} label="Pagamentos" description="Confirmações e lembretes de pagamento" checked={preferences.messageTypes.payment} onChange={() => toggle('payment')} />
          <ToggleRow icon={FileCheck} label="Comprovantes" description="Aprovação e rejeição de comprovantes" checked={preferences.messageTypes.receipt} onChange={() => toggle('receipt')} />
          <ToggleRow icon={CalendarOff} label="Disponibilidade" description="Alterações de disponibilidade" checked={preferences.messageTypes.availability} onChange={() => toggle('availability')} />
          <ToggleRow icon={Settings} label="Sistema" description="Atualizações do sistema" checked={preferences.messageTypes.system} onChange={() => toggle('system')} />
          <ToggleRow icon={Megaphone} label="Promocionais" description="Comunicados e avisos" checked={preferences.messageTypes.promotional} onChange={() => toggle('promotional')} />
        </div>
      </div>
    </motion.div>
  )
}

function ToggleRow({
  icon: Icon, label, description, checked, onChange,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0', checked ? 'bg-primary/10' : 'bg-gray-100 dark:bg-gray-800')}>
        <Icon className={cn('h-4 w-4', checked ? 'text-primary' : 'text-gray-400')} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 rounded-full transition-all duration-300 shrink-0',
          checked ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'
        )}
        aria-label={label}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-300 flex items-center justify-center',
            checked && 'translate-x-5'
          )}
        >
          {checked ? <Check className="h-3 w-3 text-primary" /> : <X className="h-3 w-3 text-gray-400" />}
        </span>
      </button>
    </div>
  )
}
