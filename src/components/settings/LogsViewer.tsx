import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card } from '../ui/Card'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'
import { Trash2, Search } from 'lucide-react'
import type { LogEntry } from '../../types/settings'

interface LogsViewerProps {
  logs: LogEntry[]
  onClear: () => void
}

const categoryOptions = [
  { value: '', label: 'Todas' },
  { value: 'settings_update', label: 'Configurações' },
  { value: 'backup_create', label: 'Backup' },
  { value: 'backup_restore', label: 'Restauração' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'payment', label: 'Pagamento' },
  { value: 'delete', label: 'Exclusão' },
]

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR')
}

const actionLabels: Record<string, string> = {
  settings_update: 'Alteração de Configuração',
  backup_create: 'Backup Criado',
  backup_restore: 'Backup Restaurado',
  login: 'Login',
  logout: 'Logout',
  payment: 'Pagamento',
  delete: 'Exclusão',
}

const actionColors: Record<string, string> = {
  settings_update: 'bg-warning/10 text-warning',
  backup_create: 'bg-primary/10 text-primary',
  backup_restore: 'bg-purple-500/10 text-purple-500',
  login: 'bg-success/10 text-success',
  logout: 'bg-gray-100 dark:bg-gray-800 text-gray-500',
  payment: 'bg-success/10 text-success',
  delete: 'bg-error/10 text-error',
}

export function LogsViewer({ logs, onClear }: LogsViewerProps) {
  const [filterCategory, setFilterCategory] = useState('')
  const [search, setSearch] = useState('')

  const filtered = logs.filter((l) => {
    if (filterCategory && l.category !== filterCategory) return false
    if (search && !l.description.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar nos logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            options={categoryOptions}
            placeholder="Categoria"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          />
        </div>
        <Button variant="danger" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={onClear}>
          Limpar logs
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Search className="h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500">Nenhum log encontrado</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((log, i) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, delay: i * 0.01 }}
              className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
            >
              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium mt-0.5 ${actionColors[log.category] || 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                {actionLabels[log.category] || log.category}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-text">{log.description}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {log.user} &middot; {formatDate(log.timestamp)}
                </p>
              </div>
            </motion.div>
          ))}
          <p className="text-[10px] text-center text-gray-400 pt-2">{filtered.length} registro(s)</p>
        </div>
      )}
    </div>
  )
}
