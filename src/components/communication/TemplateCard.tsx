import { motion } from 'framer-motion'
import { FileText, Edit2, Trash2 } from 'lucide-react'
import type { MessageTemplate } from '../../types/communication'

interface TemplateCardProps {
  template: MessageTemplate
  onEdit: (tpl: MessageTemplate) => void
  onDelete: (id: string) => void
  onUse?: (id: string) => void
}

const categoryLabels: Record<string, string> = {
  reminder: 'Lembrete', payment: 'Pagamento', vacation_return: 'Retorno Férias', welcome: 'Boas-vindas', custom: 'Personalizado',
}

const categoryColors: Record<string, string> = {
  reminder: 'bg-warning/10 text-warning', payment: 'bg-success/10 text-success',
  vacation_return: 'bg-purple-500/10 text-purple-500', welcome: 'bg-blue-500/10 text-blue-500', custom: 'bg-gray-100 dark:bg-gray-800 text-gray-500',
}

export function TemplateCard({ template, onEdit, onDelete, onUse }: TemplateCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4 hover:shadow-sm transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0" onClick={() => onUse?.(template.id)}>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <p className="text-sm font-medium text-text truncate">{template.name}</p>
          </div>
          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium mt-1 ${categoryColors[template.category] || categoryColors.custom}`}>
            {categoryLabels[template.category] || template.category}
          </span>
          <p className="text-xs text-gray-500 mt-2 line-clamp-2">{template.body}</p>
          {template.variables.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {template.variables.map((v) => (
                <span key={v} className="text-[10px] bg-primary/5 text-primary px-1.5 py-0.5 rounded">{`{{${v}}}`}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => onEdit(template)} className="h-7 w-7 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center" aria-label="Editar modelo">
            <Edit2 className="h-3.5 w-3.5 text-gray-400" />
          </button>
          <button onClick={() => onDelete(template.id)} className="h-7 w-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center" aria-label="Excluir modelo">
            <Trash2 className="h-3.5 w-3.5 text-error" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
