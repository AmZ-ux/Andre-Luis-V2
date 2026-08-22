import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '../components/ui/Card'
import { Grid } from '../components/ui/Grid'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { SkeletonCard } from '../components/ui/Skeleton'
import { ReportCardItem } from '../components/reports/ReportCard'
import { ReportFilters } from '../components/reports/ReportFilters'
import { ReportIndicatorCard } from '../components/reports/ReportIndicatorCard'
import { ReportCharts } from '../components/reports/ReportCharts'
import { ReportTable } from '../components/reports/ReportTable'
import { ReportExport } from '../components/reports/ReportExport'
import { useReports } from '../hooks/useReports'
import { REPORT_CATEGORIES } from '../types/reports'
import type { ChartType, ReportCategory } from '../types/reports'
import { Search, Download, ChevronLeft, Filter, BarChart3, TrendingUp, PieChart, Activity } from 'lucide-react'
import { cn } from '../utils/cn'

const categoryIcons: Record<ReportCategory, React.ComponentType<{ className?: string }>> = {
  financial: BarChart3,
  passengers: TrendingUp,
  availability: Activity,
  custom: PieChart,
}

const chartTypeMap: Record<string, ChartType> = {
  'financial-overview': 'bar',
  'monthly-revenue': 'bar',
  flow: 'line',
  'paid-fees': 'bar',
  'pending-fees': 'bar',
  'overdue-fees': 'bar',
  'passengers-active': 'bar',
  'passengers-by-city': 'bar',
  'passengers-by-institution': 'bar',
  'passengers-by-type': 'pie',
  'availability-overview': 'bar',
}

export function Relatorios({ embedded = false }: { embedded?: boolean }) {
  const {
    reportCards, activeReport, loading, error,
    filters, reportData, search, setSearch,
    updateFilters, resetFilters, generateReport, clearReport, reload,
  } = useReports()

  const [showFilters, setShowFilters] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<ReportCategory | 'all'>('all')

  const groupedReports = useMemo(() => {
    return REPORT_CATEGORIES.map((cat) => ({
      ...cat,
      reports: reportCards.filter((r) => r.category === cat.key),
    })).filter((g) => g.reports.length > 0)
  }, [reportCards])

  const handleBack = () => {
    clearReport()
  }

  const chartType = activeReport ? (chartTypeMap[activeReport] || 'bar') : 'bar'

  const sidebarVisible = activeReport === null

  if (error) {
    return (
      <div className="space-y-6 sm:space-y-8">
        {!embedded && (
          <PageHeader eyebrow="Operação" title="Relatórios" subtitle="Análise de dados e métricas" />
        )}
        <Card>
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="h-12 w-12 rounded-full bg-error/10 flex items-center justify-center">
              <Filter className="h-6 w-6 text-error" />
            </div>
            <p className="text-sm text-gray-500">{error}</p>
            <Button variant="secondary" onClick={reload}>Tentar novamente</Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        {!embedded && (
          <div className="flex items-start gap-3">
            {!sidebarVisible && (
              <button
                onClick={handleBack}
                className="h-9 w-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors mt-1"
                aria-label="Voltar"
              >
                <ChevronLeft className="h-4 w-4 text-text" />
              </button>
            )}
            <PageHeader
              eyebrow="Operação"
              title={activeReport && reportData ? reportData.title : 'Relatórios'}
              subtitle={
                activeReport && reportData
                  ? 'Análise detalhada do relatório selecionado'
                  : 'Análise de dados e métricas'
              }
            />
          </div>
        )}
        {embedded && !sidebarVisible && (
          <button
            onClick={handleBack}
            className="h-9 w-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-4 w-4 text-text" />
          </button>
        )}
        <div className={cn('flex gap-2 flex-wrap', embedded && 'ml-auto')}>
          <Button
            variant="secondary"
            size="sm"
            icon={<Filter className="h-4 w-4" />}
            onClick={() => setShowFilters(!showFilters)}
          >
            Filtros
          </Button>
          {activeReport && reportData && (
            <Button
              size="sm"
              icon={<Download className="h-4 w-4" />}
              onClick={() => setExportOpen(true)}
            >
              Exportar
            </Button>
          )}
        </div>
      </div>

      <ReportFilters
        filters={filters}
        onChange={updateFilters}
        onReset={resetFilters}
        visible={showFilters}
      />

      {loading && !reportData && (
        <Grid cols={{ default: 1, sm: 2, lg: 3 }} gap={4}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </Grid>
      )}

      {sidebarVisible && !loading && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
            <button
              onClick={() => setActiveCategory('all')}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-200',
                activeCategory === 'all'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              )}
            >
              Todos
            </button>
            {REPORT_CATEGORIES.filter((c) =>
              reportCards.some((r) => r.category === c.key)
            ).map((cat) => {
              const Icon = categoryIcons[cat.key]
              return (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-1.5',
                    activeCategory === cat.key
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {cat.label}
                </button>
              )
            })}
          </div>

          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar relatórios..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
            />
          </div>

          {groupedReports.map((group) => {
            const filtered = activeCategory === 'all'
              ? group.reports
              : group.reports.filter((r) => r.category === activeCategory)
            if (filtered.length === 0) return null

            const Icon = categoryIcons[group.key]
            return (
              <div key={group.key}>
                <div className="flex items-center gap-2 mb-4">
                  <Icon className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-text">{group.label}</h2>
                  <span className="text-xs text-gray-400">({filtered.length})</span>
                </div>
                <Grid cols={{ default: 1, sm: 2, lg: 3 }} gap={4}>
                  {filtered.map((report, i) => (
                    <ReportCardItem
                      key={report.id}
                      report={report}
                      selected={false}
                      onClick={() => generateReport(report.id)}
                      index={i}
                    />
                  ))}
                </Grid>
              </div>
            )
          })}

          {reportCards.length === 0 && !loading && (
            <Card>
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Search className="h-8 w-8 text-gray-300" />
                <p className="text-sm text-gray-500">Nenhum relatório encontrado para &ldquo;{search}&rdquo;</p>
              </div>
            </Card>
          )}
        </>
      )}

      <AnimatePresence mode="wait">
        {activeReport && reportData && (
          <motion.div
            key={activeReport}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {reportData.indicators.length > 0 && (
              <Grid cols={{ default: 2, sm: 3, lg: 4, xl: 5 }} gap={3}>
                {reportData.indicators.map((indicator, i) => (
                  <ReportIndicatorCard key={i} indicator={indicator} index={i} />
                ))}
              </Grid>
            )}

            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-text">Gráfico</h3>
                <div className="flex gap-1">
                  <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md capitalize">
                    {chartType === 'bar' ? 'Barras' : chartType === 'line' ? 'Linha' : chartType === 'pie' ? 'Pizza' : chartType === 'donut' ? 'Donut' : 'Área'}
                  </span>
                </div>
              </div>
              <ReportCharts
                data={reportData.chartData}
                chartType={chartType}
                loading={loading}
              />
            </Card>

            <Card>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-text">Detalhamento</h3>
              </div>
              <ReportTable data={reportData} loading={loading} />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <ReportExport
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        data={reportData}
        filters={filters}
      />
    </div>
  )
}
