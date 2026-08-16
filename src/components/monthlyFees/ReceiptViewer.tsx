import { useState, useEffect, useCallback } from 'react'
import { Button } from '../ui/Button'
import { FileText, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { realReceipts } from '../../services/realApi'
import type { ReceiptStatus } from '../../types/monthlyFee'
import { cn } from '../../utils/cn'

interface ReceiptViewerProps {
  receipt: string
  receiptStatus?: ReceiptStatus
  isAdmin?: boolean
  paymentId?: string
  onApproved?: (status: ReceiptStatus) => void
}

const statusConfig: Record<ReceiptStatus, { label: string; className: string }> = {
  none: { label: 'Sem comprovante', className: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
  pending: { label: 'Aguardando aprovação', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  approved: { label: 'Comprovante aprovado', className: 'bg-success/10 text-success' },
  rejected: { label: 'Comprovante rejeitado', className: 'bg-error/10 text-error' },
}

export function ReceiptViewer({ receipt, receiptStatus = 'none', isAdmin = false, paymentId, onApproved }: ReceiptViewerProps) {
  const [blobUrl, setBlobUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [currentStatus, setCurrentStatus] = useState<ReceiptStatus>(receiptStatus)

  const isRemote = receipt.startsWith('/receipts/') || receipt.startsWith('/api/') || receipt.startsWith('http')

  useEffect(() => {
    setCurrentStatus(receiptStatus)
  }, [receiptStatus])

  const loadRemote = useCallback(async () => {
    if (!receipt.startsWith('/receipts/') && !receipt.startsWith('/api/')) return
    setLoading(true)
    try {
      const blob = await realReceipts.download(receipt)
      setBlobUrl(URL.createObjectURL(blob))
    } catch {
      setBlobUrl('')
    } finally {
      setLoading(false)
    }
  }, [receipt])

  useEffect(() => {
    if (isRemote && (receipt.startsWith('/receipts/') || receipt.startsWith('/api/'))) loadRemote()
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [receipt, isRemote, loadRemote]) // eslint-disable-line react-hooks/exhaustive-deps

  const isPdf = receipt.toLowerCase().endsWith('.pdf') || blobUrl.toLowerCase().endsWith('.pdf')
  const src = isRemote ? blobUrl : receipt
  const cfg = statusConfig[currentStatus]

  const handleAction = async (approve: boolean) => {
    if (!paymentId) return
    setActionLoading(true)
    try {
      const res = approve ? await realReceipts.approve(paymentId) : await realReceipts.reject(paymentId)
      setCurrentStatus(res.receiptStatus as ReceiptStatus)
      onApproved?.(res.receiptStatus as ReceiptStatus)
    } catch {
      setCurrentStatus(currentStatus)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium', cfg.className)}>
          {currentStatus === 'approved' ? <CheckCircle2 className="h-3.5 w-3.5" /> : currentStatus === 'rejected' ? <XCircle className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
          {cfg.label}
        </span>
        {isAdmin && currentStatus === 'pending' && (
          <div className="flex gap-2">
            <Button size="sm" variant="primary" loading={actionLoading} onClick={() => handleAction(true)}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar
            </Button>
            <Button size="sm" variant="danger" disabled={actionLoading} onClick={() => handleAction(false)}>
              <XCircle className="h-4 w-4 mr-1" /> Rejeitar
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 py-12 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : isPdf ? (
        <iframe src={src} title="Comprovante" className="h-64 w-full rounded-xl border border-gray-200 dark:border-gray-700" />
      ) : src ? (
        <img src={src} alt="Comprovante de pagamento" className="max-h-64 rounded-xl border border-gray-200 dark:border-gray-700 object-contain bg-white" />
      ) : null}
    </div>
  )
}