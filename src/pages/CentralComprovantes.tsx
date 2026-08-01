import { useState, useCallback } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useReceipts } from '../hooks/useReceipts'
import { ReceiptTable } from '../components/receipts/ReceiptTable'
import { ReceiptCard } from '../components/receipts/ReceiptCard'
import { ReceiptFiltersPanel } from '../components/receipts/ReceiptFilters'
import { ApprovalModal } from '../components/receipts/ApprovalModal'
import { RejectModal } from '../components/receipts/RejectModal'
import { ViewToggle } from '../components/passengers/ViewToggle'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useToast } from '../contexts/ToastContext'
import { useIsMobile } from '../hooks/useBreakpoint'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '../utils/cn'
import type { Receipt } from '../types/receipt'
import type { ViewMode } from '../types/passenger'

export function ComprovantesSection({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth()
  const { addToast } = useToast()
  const {
    receipts, summary, loading, error, filters, sort, pagination, totalPages,
    updateFilters, resetFilters, setPage, setSortField,
    approveReceipt, rejectReceipt, markViewed, reload,
  } = useReceipts()
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const isMobile = useIsMobile()
  const [viewingReceipt, setViewingReceipt] = useState<Receipt | null>(null)
  const [approvingReceipt, setApprovingReceipt] = useState<Receipt | null>(null)
  const [rejectingReceipt, setRejectingReceipt] = useState<Receipt | null>(null)

  const handleView = useCallback((receipt: Receipt) => {
    setViewingReceipt(receipt)
    if (user && receipt.status === 'awaiting') {
      markViewed(receipt.id, user.name, user.id)
    }
  }, [user, markViewed])

  const handleApprove = useCallback((receipt: Receipt) => {
    setApprovingReceipt(receipt)
  }, [])

  const handleReject = useCallback((receipt: Receipt) => {
    setRejectingReceipt(receipt)
  }, [])

  const handleApproveConfirm = useCallback(async (notes: string) => {
    if (!approvingReceipt || !user) return
    await approveReceipt(approvingReceipt.id, user.name, user.id, notes)
    addToast('success', 'Comprovante aprovado! Mensalidade atualizada para Paga.')
    setApprovingReceipt(null)
  }, [approvingReceipt, user, approveReceipt, addToast])

  const handleRejectConfirm = useCallback(async (reason: string) => {
    if (!rejectingReceipt || !user) return
    await rejectReceipt(rejectingReceipt.id, user.name, user.id, reason)
    addToast('success', 'Comprovante rejeitado.')
    setRejectingReceipt(null)
  }, [rejectingReceipt, user, rejectReceipt, addToast])

  if (loading && receipts.length === 0) {
    return (
      <div className="space-y-6">
        {!embedded && (
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-text">Central de Comprovantes</h1>
              <p className="text-sm text-gray-500 mt-1">Analise os comprovantes enviados pelos passageiros</p>
            </div>
          </div>
        )}
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-gray-500 mb-4">{error}</p>
        <Button onClick={reload}>Tentar novamente</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {!embedded && (
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text">Central de Comprovantes</h1>
          <p className="text-sm text-gray-500 mt-1">Analise os comprovantes enviados pelos passageiros</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Aguardando', value: summary.awaiting, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900/20' },
          { label: 'Aprovados', value: summary.approved, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/20' },
          { label: 'Rejeitados', value: summary.rejected, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/20' },
          { label: 'Total', value: summary.total, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700' },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className={`rounded-2xl border p-4 ${item.bg}`}
          >
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{item.label}</p>
            <p className={`text-2xl font-bold mt-1 ${item.color}`}>{item.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value })}
            placeholder="Buscar por nome, CPF, competência..."
            className="w-full h-11 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-10 pr-4 text-sm text-text dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
        <div className="flex items-center gap-3">
          <ReceiptFiltersPanel filters={filters} onChange={updateFilters} onReset={resetFilters} />
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {viewMode === 'list' && !isMobile ? (
        <Card padding={false} className="overflow-hidden">
          <ReceiptTable
            receipts={receipts}
            sort={sort}
            onSort={setSortField}
            onView={handleView}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {receipts.map((receipt, i) => (
            <ReceiptCard key={receipt.id} receipt={receipt} index={i} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="h-11 w-11 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-5 w-5 text-text" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setPage(page)}
              className={cn(
                'min-w-[44px] h-11 rounded-xl text-sm font-medium transition-all',
                page === pagination.page
                  ? 'bg-primary text-white shadow-sm'
                  : 'border border-gray-200 dark:border-gray-700 text-text hover:bg-gray-50 dark:hover:bg-gray-800'
              )}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setPage(pagination.page + 1)}
            disabled={pagination.page >= totalPages}
            className="h-11 w-11 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            aria-label="Próxima página"
          >
            <ChevronRight className="h-5 w-5 text-text" />
          </button>
        </div>
      )}

      {viewingReceipt && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setViewingReceipt(null)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-lg font-semibold text-text">Comprovante</h2>
                <button
                  onClick={() => setViewingReceipt(null)}
                  className="h-11 w-11 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center"
                >
                  <span className="text-gray-500 text-lg">✕</span>
                </button>
              </div>
              <div className="flex flex-col lg:grid lg:grid-cols-3 gap-0">
                <div className="lg:col-span-2 bg-gray-50 dark:bg-gray-800/50 p-4 sm:p-6 flex items-center justify-center min-h-[200px] sm:min-h-[300px]">
                  {viewingReceipt.fileType.startsWith('image/') ? (
                    <img
                      src={viewingReceipt.fileData}
                      alt={viewingReceipt.fileName}
                      className="max-w-full max-h-[60vh] rounded-xl object-contain shadow-sm"
                    />
                  ) : (
                    <iframe
                      src={viewingReceipt.fileData}
                      title={viewingReceipt.fileName}
                      className="w-full h-[60vh] rounded-xl border"
                    />
                  )}
                </div>
                <div className="p-4 sm:p-6 border-t lg:border-t-0 lg:border-l border-gray-100 dark:border-gray-800 space-y-5">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Passageiro</p>
                    <p className="text-sm font-semibold text-text mt-1">{viewingReceipt.passengerName}</p>
                    <p className="text-xs text-gray-400">{viewingReceipt.cpf}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Mensalidade</p>
                    <p className="text-sm text-text mt-1">
                      {String(viewingReceipt.month).padStart(2, '0')}/{viewingReceipt.year}
                    </p>
                    <p className="text-sm font-semibold text-text">
                      R$ {viewingReceipt.amount.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Arquivo</p>
                    <p className="text-xs text-text mt-1 truncate">{viewingReceipt.fileName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Enviado em</p>
                    <p className="text-sm text-text mt-1">{viewingReceipt.createdAt}</p>
                  </div>
                  {viewingReceipt.status === 'awaiting' && (
                    <div className="space-y-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                      <Button
                        fullWidth
                        onClick={() => { handleApprove(viewingReceipt); setViewingReceipt(null) }}
                      >
                        Aprovar
                      </Button>
                      <Button
                        fullWidth
                        variant="danger"
                        onClick={() => { handleReject(viewingReceipt); setViewingReceipt(null) }}
                      >
                        Rejeitar
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ApprovalModal
        isOpen={!!approvingReceipt}
        onClose={() => setApprovingReceipt(null)}
        onConfirm={handleApproveConfirm}
        receipt={approvingReceipt}
      />

      <RejectModal
        isOpen={!!rejectingReceipt}
        onClose={() => setRejectingReceipt(null)}
        onConfirm={handleRejectConfirm}
        receipt={rejectingReceipt}
      />
    </div>
  )
}
