import type { ReportFilters } from '../types/reports'

export const exportService = {
  toCSV(data: Record<string, unknown>[], columns: { key: string; label: string }[], title: string, filters?: ReportFilters): string {
    const separator = ';'
    const lines: string[] = []

    lines.push(`Relatório: ${title}`)
    lines.push(`Emissão: ${new Date().toLocaleString('pt-BR')}`)
    lines.push('')

    if (filters) {
      lines.push('Filtros aplicados:')
      if (filters.period) lines.push(`Período: ${filters.period}`)
      if (filters.year) lines.push(`Ano: ${filters.year}`)
      if (filters.city) lines.push(`Cidade: ${filters.city}`)
      if (filters.transportType) {
        const labels: Record<string, string> = { university: 'Universitário', school: 'Escolar', contract: 'Contrato' }
        lines.push(`Tipo: ${labels[filters.transportType] || filters.transportType}`)
      }
      lines.push('')
    }

    const header = columns.map((c) => `"${c.label}"`).join(separator)
    lines.push(header)

    data.forEach((row) => {
      const rowValues = columns.map((col) => {
        const value = row[col.key]
        if (value === null || value === undefined) return '""'
        return `"${String(value).replace(/"/g, '""')}"`
      })
      lines.push(rowValues.join(separator))
    })

    lines.push('')
    lines.push(`Total de registros: ${data.length}`)
    lines.push(`Sistema de Gerenciamento de Mensalidades de Transporte`)

    return lines.join('\n')
  },

  downloadCSV(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  },

  print(): void {
    window.print()
  },

  generateFilename(title: string): string {
    const date = new Date().toISOString().split('T')[0]
    return `${title.toLowerCase().replace(/\s+/g, '_')}_${date}.csv`
  },
}
