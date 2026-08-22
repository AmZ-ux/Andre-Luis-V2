import { useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMonthlyFees } from '../hooks/useMonthlyFees'
import { useSettings } from '../hooks/useSettings'
import { MonthlySearch } from '../components/monthlyFees/MonthlySearch'
import { MonthlyFilters } from '../components/monthlyFees/MonthlyFilters'
import { FinancialSummary } from '../components/monthlyFees/FinancialSummary'
import { MonthlyFeeTable } from '../components/monthlyFees/MonthlyFeeTable'
import { MonthlyFeeCard } from '../components/monthlyFees/MonthlyFeeCard'
import { CancelModal } from '../components/monthlyFees/CancelModal'
import { ExemptionModal } from '../components/monthlyFees/ExemptionModal'
import { EditFeeModal } from '../components/monthlyFees/EditFeeModal'
import { ManualPaymentModal } from '../components/monthlyFees/ManualPaymentModal'
import { BillingSettingsForm } from '../components/settings/BillingSettings'
import { PageTabs } from '../components/ui/PageTabs'
import { PageHeader } from '../components/ui/PageHeader'
import { ViewToggle } from '../components/passengers/ViewToggle'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Pagination } from '../components/ui/Pagination'
import { SkeletonTable } from '../components/ui/Skeleton'
import { useToast } from '../contexts/ToastContext'
import { useIsMobile } from '../hooks/useBreakpoint'
import { Wallet, SlidersHorizontal } from 'lucide-react'
import type { MonthlyFee } from '../types/monthlyFee'
import type { ViewMode } from '../types/passenger'

const tabs = [
  { key: 'faturas', label: 'Faturas', icon: Wallet },
  { key: 'regras', label: 'Regras de cobrança', icon: SlidersHorizontal },
]

export function Mensalidades() {
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    fees, summary, loading, error, filters, sort, pagination, totalPages,
    updateFilters, resetFilters, setPage, setSortField,
    registerPayment, cancelFee, exemptFee, updateFee, reload,
  } = useMonthlyFees()
  const { settings, updateCategory, saved } = useSettings()
  const { addToast } = useToast()
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const isMobile = useIsMobile()

  const tabParam = searchParams.get('tab')
  const tab = tabParam === 'regras' ? 'regras' : 'faturas'

  const handleTabChange = (key: string) => {
    setSearchParams(key === 'faturas' ? {} : { tab: key }, { replace: true })
  }
  const [selectedFee, setSelectedFee] = useState<MonthlyFee | null>(null)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [exemptionModalOpen, setExemptionModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)

  const handlePay = useCallback((fee: MonthlyFee) => {
    setSelectedFee(fee)
    setPaymentModalOpen(true)
  }, [])

  const handlePayConfirm = useCallback(
    async (data: { amount: number; paymentDate: string; paymentMethod: string; notes?: string }) => {
      if (!selectedFee) return
      await registerPayment(selectedFee.id, {
        ...data,
        paymentMethod: data.paymentMethod as import('../types/passenger').PaymentMethod,
      })
      addToast('success', 'Pagamento registrado com sucesso!')
    },
    [selectedFee, registerPayment, addToast]
  )

  const handleCancel = useCallback((fee: MonthlyFee) => {
    setSelectedFee(fee)
    setCancelModalOpen(true)
  }, [])

  const handleExempt = useCallback((fee: MonthlyFee) => {
    setSelectedFee(fee)
    setExemptionModalOpen(true)
  }, [])

  const handleEdit = useCallback((fee: MonthlyFee) => {
    setSelectedFee(fee)
    setEditModalOpen(true)
  }, [])

  const handleCancelConfirm = useCallback(
    async (reason: string) => {
      if (!selectedFee) return
      await cancelFee(selectedFee.id, reason)
      addToast('success', 'Mensalidade cancelada com sucesso!')
    },
    [selectedFee, cancelFee, addToast]
  )

  const handleExemptConfirm = useCallback(
    async (reason: string) => {
      if (!selectedFee) return
      await exemptFee(selectedFee.id, reason)
      addToast('success', 'Isenção registrada com sucesso!')
    },
    [selectedFee, exemptFee, addToast]
  )

  const handleEditConfirm = useCallback(
    async (data: { amount: string; dueDay: string; notes: string }) => {
      if (!selectedFee) return
      await updateFee(selectedFee.id, data)
      addToast('success', 'Mensalidade atualizada com sucesso!')
    },
    [selectedFee, updateFee, addToast]
  )

  if (loading && fees.length === 0) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <PageHeader className="hidden sm:block" eyebrow="Financeiro" title="Mensalidades" subtitle="Controle de pagamentos mensais" />
        <PageTabs tabs={tabs} value={tab} onChange={handleTabChange} />
        <SkeletonTable />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <PageHeader className="hidden sm:block" eyebrow="Financeiro" title="Mensalidades" subtitle="Controle de pagamentos mensais" />
        <PageTabs tabs={tabs} value={tab} onChange={handleTabChange} />
        <div className="text-center py-16">
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <Button onClick={reload}>Tentar novamente</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        className="hidden sm:block"
        eyebrow="Financeiro"
        title="Mensalidades"
        subtitle={
          tab === 'regras'
            ? 'Regras de cobrança e férias'
            : 'Controle de pagamentos mensais'
        }
      />

      <PageTabs tabs={tabs} value={tab} onChange={handleTabChange} />

      {tab === 'regras' && (
        <Card>
          <BillingSettingsForm
            settings={settings.billing}
            onSave={(v) => updateCategory('billing', v)}
            saved={saved}
          />
        </Card>
      )}

      {tab === 'faturas' && (
        <>
      <FinancialSummary fees={fees} summary={summary} />

      <Card>
        <div className="flex flex-col sm:flex-row gap-4 mb-2">
          <MonthlySearch
            value={filters.search}
            onChange={(v) => updateFilters({ search: v })}
            className="flex-1"
          />
          <div className="flex items-center gap-3">
            <MonthlyFilters
              filters={filters}
              onChange={updateFilters}
              onReset={resetFilters}
            />
            <ViewToggle value={viewMode} onChange={setViewMode} />
          </div>
        </div>
      </Card>

      {viewMode === 'list' && !isMobile ? (
        <Card padding={false} className="overflow-hidden">
          <MonthlyFeeTable
            fees={fees}
            sort={sort}
            onSort={setSortField}
            onCancel={handleCancel}
            onExempt={handleExempt}
            onEdit={handleEdit}
            onPay={handlePay}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {fees.map((fee) => (
            <MonthlyFeeCard
              key={fee.id}
              fee={fee}
              onCancel={handleCancel}
              onExempt={handleExempt}
              onEdit={handleEdit}
              onPay={handlePay}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination
          page={pagination.page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}

      <CancelModal
        isOpen={cancelModalOpen}
        onClose={() => { setCancelModalOpen(false); setSelectedFee(null) }}
        onConfirm={handleCancelConfirm}
        fee={selectedFee}
      />

      <ExemptionModal
        isOpen={exemptionModalOpen}
        onClose={() => { setExemptionModalOpen(false); setSelectedFee(null) }}
        onConfirm={handleExemptConfirm}
        fee={selectedFee}
      />

      <EditFeeModal
        isOpen={editModalOpen}
        onClose={() => { setEditModalOpen(false); setSelectedFee(null) }}
        onConfirm={handleEditConfirm}
        fee={selectedFee}
      />

      <ManualPaymentModal
        isOpen={paymentModalOpen}
        onClose={() => { setPaymentModalOpen(false); setSelectedFee(null) }}
        onConfirm={handlePayConfirm}
        fee={selectedFee}
      />
        </>
      )}
    </div>
  )
}
