import { Clock, CheckCircle, XCircle, Eye, Upload, X, FileText } from 'lucide-react'
import type { ReceiptHistoryEntry, ReceiptHistoryAction } from '../../types/receipt'

interface ReceiptTimelineProps {
  history: ReceiptHistoryEntry[]
}

const actionConfig: Record<ReceiptHistoryAction, { icon: typeof Clock; color: string; label: string }> = {
  created: { icon: Upload, color: 'text-primary', label: 'Comprovante enviado' },
  viewed: { icon: Eye, color: 'text-blue-500', label: 'Visualizado pelo administrador' },
  approved: { icon: CheckCircle, color: 'text-success', label: 'Aprovado' },
  rejected: { icon: XCircle, color: 'text-error', label: 'Rejeitado' },
  replaced: { icon: Upload, color: 'text-warning', label: 'Comprovante substituído' },
  cancelled_analysis: { icon: X, color: 'text-gray-500', label: 'Análise cancelada' },
}

export function ReceiptTimeline({ history }: ReceiptTimelineProps) {
  if (history.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">Nenhum registro de histórico</p>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {history.map((entry, i) => {
        const config = actionConfig[entry.action]
        const Icon = config.icon
        const isLast = i === history.length - 1

        return (
          <div key={entry.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center ${config.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              {!isLast && <div className="w-px flex-1 bg-gray-200 dark:bg-gray-700" />}
            </div>
            <div className={`pb-6 ${isLast ? '' : ''}`}>
              <p className="text-sm font-medium text-text">{config.label}</p>
              {entry.notes && (
                <p className="text-xs text-gray-500 mt-0.5 flex items-start gap-1">
                  <FileText className="h-3 w-3 mt-0.5 shrink-0" />
                  {entry.notes}
                </p>
              )}
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-400">{entry.performedBy}</span>
                <span className="text-xs text-gray-300">•</span>
                <span className="text-xs text-gray-400">{entry.createdAt}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
