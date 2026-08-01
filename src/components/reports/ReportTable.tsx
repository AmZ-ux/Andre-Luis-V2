import { motion } from 'framer-motion'
import type { ReportData } from '../../types/reports'

interface ReportTableProps {
  data: ReportData
  loading?: boolean
}

export function ReportTable({ data, loading }: ReportTableProps) {
  if (loading) {
    return (
      <div className="h-48 flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    )
  }

  if (!data.tableData || data.tableData.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-sm text-gray-400">
        Nenhum registro encontrado
      </div>
    )
  }

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-'
    if (typeof value === 'number') {
      return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
    return String(value)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="overflow-x-auto -mx-5 sm:-mx-6"
    >
      <div className="inline-block min-w-full align-middle">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              {data.tableColumns.map((col) => (
                <th
                  key={col.key}
                  className={`px-5 sm:px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.tableData.map((row, i) => (
              <motion.tr
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.02 }}
                className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
              >
                {data.tableColumns.map((col) => {
                  const value = row[col.key]
                  const formatted = formatValue(value)
                  const isNumeric = typeof value === 'number'
                  return (
                    <td
                      key={col.key}
                      className={`px-5 sm:px-6 py-3 text-sm ${
                        col.align === 'right'
                          ? 'text-right font-medium'
                          : col.align === 'center'
                          ? 'text-center'
                          : 'text-text'
                      } ${isNumeric ? 'font-medium tabular-nums' : ''}`}
                    >
                      {formatted}
                    </td>
                  )
                })}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-5 sm:px-6 py-3 border-t border-gray-100 dark:border-gray-800">
        <p className="text-xs text-gray-400">
          Total de registros: {data.tableData.length}
        </p>
      </div>
    </motion.div>
  )
}
