import { motion } from 'framer-motion'
import { Button } from '../ui/Button'
import { Trash2, History } from 'lucide-react'
import type { AuditEntry } from '../../types/settings'
import { SETTINGS_CATEGORIES } from '../../types/settings'

interface AuditHistoryProps {
  auditLog: AuditEntry[]
  onClear: () => void
}

const catLabel = SETTINGS_CATEGORIES.reduce<Record<string, string>>((acc, c) => {
  acc[c.key] = c.label
  return acc
}, {} as Record<string, string>)

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR')
}

export function AuditHistory({ auditLog, onClear }: AuditHistoryProps) {
  const filtered = auditLog

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <History className="h-8 w-8 text-gray-300" />
        <p className="text-sm text-gray-500">Nenhuma alteração registrada</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{filtered.length} registro(s) de auditoria</p>
        <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={onClear}>
          Limpar
        </Button>
      </div>
      <div className="space-y-1">
        {filtered.map((entry, i) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15, delay: i * 0.01 }}
            className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
          >
            <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  {catLabel[entry.category] || entry.category}
                </span>
                <span className="text-[10px] text-gray-400">{entry.field}</span>
              </div>
              <p className="text-xs text-text mt-1">
                <span className="text-error line-through mr-1">{entry.previousValue}</span>
                <span className="text-success">→ {entry.newValue}</span>
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {entry.changedBy} &middot; {formatDate(entry.changedAt)}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
