import { motion } from 'framer-motion'
import { templateService } from '../../services/templateService'
import { useState } from 'react'
import { Search, FileText } from 'lucide-react'

interface TemplateSelectorProps {
  onSelect: (id: string) => void
  onClose: () => void
}

export function TemplateSelector({ onSelect, onClose: _onClose }: TemplateSelectorProps) {
  const [search, setSearch] = useState('')
  const templates = templateService.list()

  const filtered = search
    ? templates.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.body.toLowerCase().includes(search.toLowerCase())
      )
    : templates

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-800/30 overflow-hidden"
    >
      <div className="p-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar modelos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {filtered.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => onSelect(tpl.id)}
              className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors text-left"
            >
              <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-text truncate">{tpl.name}</p>
                <p className="text-[10px] text-gray-500 truncate">{tpl.body}</p>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">Nenhum modelo encontrado</p>
          )}
        </div>
      </div>
    </motion.div>
  )
}
