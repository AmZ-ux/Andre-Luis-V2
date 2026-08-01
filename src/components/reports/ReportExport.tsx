import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { FileDown, Printer } from 'lucide-react'
import { exportService } from '../../services/exportService'
import type { ReportData, ReportFilters } from '../../types/reports'

interface ReportExportProps {
  open: boolean
  onClose: () => void
  data: ReportData | null
  filters?: ReportFilters
}

export function ReportExport({ open, onClose, data, filters }: ReportExportProps) {
  if (!data) return null

  const handleCSV = () => {
    const csv = exportService.toCSV(data.tableData, data.tableColumns, data.title, filters)
    const filename = exportService.generateFilename(data.title)
    exportService.downloadCSV(csv, filename)
    onClose()
  }

  const handlePrint = () => {
    onClose()
    setTimeout(() => exportService.print(), 300)
  }

  return (
    <Modal isOpen={open} onClose={onClose} title="Exportar Relatório">
      <p className="text-sm text-gray-500 mb-5">
        Escolha o formato para exportar &ldquo;{data.title}&rdquo;
      </p>

      <div className="space-y-3">
        <button
          onClick={handleCSV}
          className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
        >
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FileDown className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text">CSV</p>
            <p className="text-xs text-gray-500">Arquivo separado por ponto e vírgula</p>
          </div>
        </button>

        <button
          onClick={handlePrint}
          className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
        >
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Printer className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text">Imprimir / PDF</p>
            <p className="text-xs text-gray-500">Imprimir ou salvar como PDF</p>
          </div>
        </button>
      </div>

      <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
        <Button variant="secondary" fullWidth onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </Modal>
  )
}
