import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { motion } from 'framer-motion'
import { receiptService } from '../services/receiptService'
import { receiptHistory } from '../services/receiptHistory'
import { receiptApproval } from '../services/receiptApproval'
import { ReceiptStatus } from '../components/receipts/ReceiptStatus'
import { ReceiptTimeline } from '../components/receipts/ReceiptTimeline'
import { ApprovalModal } from '../components/receipts/ApprovalModal'
import { RejectModal } from '../components/receipts/RejectModal'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { PageSpinner } from '../components/ui/Spinner'
import { useToast } from '../contexts/ToastContext'
import { ArrowLeft, User, DollarSign, Calendar, FileText, Building2 } from 'lucide-react'
import type { Receipt, ReceiptHistoryEntry } from '../types/receipt'

const paymentLabels: Record<string, string> = {
  university: 'Universitário',
  school: 'Escolar',
  contract: 'Contrato',
}

export function ComprovanteDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addToast } = useToast()
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [history, setHistory] = useState<ReceiptHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showApproval, setShowApproval] = useState(false)
  const [showReject, setShowReject] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      receiptService.getById(id),
      receiptHistory.getByReceiptId(id),
    ])
      .then(([r, h]) => {
        if (!r) setError(true)
        else { setReceipt(r); setHistory(h) }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  const handleApprove = async (notes: string) => {
    if (!receipt || !user) return
    const updated = await receiptApproval.approve(receipt.id, user.name, user.id, notes)
    setReceipt(updated)
    const h = await receiptHistory.getByReceiptId(receipt.id)
    setHistory(h)
    addToast('success', 'Comprovante aprovado! Mensalidade atualizada para Paga.')
  }

  const handleReject = async (reason: string) => {
    if (!receipt || !user) return
    const updated = await receiptApproval.reject(receipt.id, user.name, user.id, reason)
    setReceipt(updated)
    const h = await receiptHistory.getByReceiptId(receipt.id)
    setHistory(h)
    addToast('success', 'Comprovante rejeitado.')
  }

  if (loading) return <PageSpinner />
  if (error || !receipt) {
    return (
      <div className="text-center py-16">
        <h2 className="text-lg font-semibold text-text">Comprovante não encontrado</h2>
        <Button onClick={() => navigate('/mensalidades?tab=comprovantes')} className="mt-4">
          Voltar para central
        </Button>
      </div>
    )
  }

  const isAwaiting = receipt.status === 'awaiting'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-4xl mx-auto"
    >
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-light transition-colors mb-2"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text">Detalhes do Comprovante</h1>
          <p className="text-sm text-gray-500 mt-1">{receipt.fileName}</p>
        </div>
        <ReceiptStatus status={receipt.status} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <h2 className="text-sm font-bold text-text mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Arquivo
            </h2>
            {receipt.fileType.startsWith('image/') ? (
              <img
                src={receipt.fileData}
                alt={receipt.fileName}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700"
              />
            ) : (
              <iframe
                src={receipt.fileData}
                title={receipt.fileName}
                className="w-full h-96 rounded-xl border border-gray-200 dark:border-gray-700"
              />
            )}
          </Card>

          <Card>
            <h2 className="text-sm font-bold text-text mb-4 flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Dados do Passageiro
            </h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Nome</p>
                  <p className="text-sm text-text">{receipt.passengerName}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Building2 className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">CPF</p>
                  <p className="text-sm text-text">{receipt.cpf}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Building2 className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Tipo</p>
                  <p className="text-sm text-text">{paymentLabels[receipt.transportType] || receipt.transportType}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="text-sm font-bold text-text mb-4 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" /> Mensalidade
            </h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Competência</p>
                  <p className="text-sm text-text">{String(receipt.month).padStart(2, '0')}/{receipt.year}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <DollarSign className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Valor</p>
                  <p className="text-sm font-semibold text-text">
                    R$ {receipt.amount.toFixed(2).replace('.', ',')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Data de envio</p>
                  <p className="text-sm text-text">{receipt.createdAt}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Status</p>
                  <ReceiptStatus status={receipt.status} />
                </div>
              </div>
            </div>
            {receipt.reviewNotes && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-400 mb-1">
                  {receipt.status === 'approved' ? 'Observação da aprovação' : 'Motivo'}
                </p>
                <p className="text-sm text-text">{receipt.reviewNotes}</p>
                {receipt.reviewedBy && (
                  <p className="text-xs text-gray-400 mt-1">
                    Responsável: {receipt.reviewedBy} em {receipt.reviewDate}
                  </p>
                )}
              </div>
            )}
          </Card>

          {isAwaiting && user?.role === 'admin' && (
            <Card>
              <h2 className="text-sm font-bold text-text mb-4">Análise</h2>
              <div className="space-y-3">
                <Button fullWidth onClick={() => setShowApproval(true)}>
                  Aprovar Comprovante
                </Button>
                <Button fullWidth variant="danger" onClick={() => setShowReject(true)}>
                  Rejeitar Comprovante
                </Button>
              </div>
            </Card>
          )}

          <Card>
            <h2 className="text-sm font-bold text-text mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" /> Histórico
            </h2>
            <ReceiptTimeline history={history} />
          </Card>
        </div>
      </div>

      <ApprovalModal
        isOpen={showApproval}
        onClose={() => setShowApproval(false)}
        onConfirm={handleApprove}
        receipt={receipt}
      />

      <RejectModal
        isOpen={showReject}
        onClose={() => setShowReject(false)}
        onConfirm={handleReject}
        receipt={receipt}
      />
    </motion.div>
  )
}
