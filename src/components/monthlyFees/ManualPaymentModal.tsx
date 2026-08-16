import { useState, useEffect, useCallback } from 'react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { Upload, X, ImageIcon, FileText } from 'lucide-react'
import type { MonthlyFee } from '../../types/monthlyFee'
import type { PaymentMethod } from '../../types/passenger'
import { config } from '../../config'
import { realReceipts } from '../../services/realApi'

interface ManualPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: {
    amount: number
    paymentDate: string
    paymentMethod: PaymentMethod
    notes?: string
    receipt?: string
  }) => Promise<void>
  fee: MonthlyFee | null
}

const MAX_RECEIPT_SIZE = 5 * 1024 * 1024

const ALLOWED_RECEIPT_TYPES = ['image/jpeg', 'image/png', 'application/pdf']

const paymentMethodOptions = [
  { value: 'pix', label: 'PIX' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'transfer', label: 'Transferência' },
  { value: 'card', label: 'Cartão' },
]

function todayBR(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo'))
    reader.readAsDataURL(file)
  })
}

export function ManualPaymentModal({ isOpen, onClose, onConfirm, fee }: ManualPaymentModalProps) {
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(todayBR())
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix')
  const [notes, setNotes] = useState('')
  const [receipt, setReceipt] = useState('')
  const [receiptName, setReceiptName] = useState('')
  const [receiptPreview, setReceiptPreview] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [receiptError, setReceiptError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (fee) {
      setAmount(fee.amount.toFixed(2).replace('.', ','))
      setPaymentDate(todayBR())
      setPaymentMethod('pix')
      setNotes('')
      setReceipt('')
      setReceiptName('')
      setReceiptPreview('')
      setErrors({})
      setReceiptError('')
    }
  }, [fee, isOpen])

  const handleFile = useCallback(async (file: File | undefined) => {
    setReceiptError('')
    if (!file) return
    if (!ALLOWED_RECEIPT_TYPES.includes(file.type)) {
      setReceiptError('Envie uma imagem (JPG, PNG) ou PDF')
      return
    }
    if (file.size > MAX_RECEIPT_SIZE) {
      setReceiptError('Arquivo muito grande (máximo 5MB)')
      return
    }
    try {
      const localPreview = URL.createObjectURL(file)
      if (config.realApi) {
        const res = await realReceipts.upload(file)
        setReceipt(res.url)
      } else {
        const dataUrl = await readFileAsDataURL(file)
        setReceipt(dataUrl)
      }
      setReceiptName(file.name)
      setReceiptPreview(localPreview)
    } catch {
      setReceiptError('Não foi possível enviar o arquivo')
    }
  }, [])

  const parseAmount = (value: string): number | null => {
    const normalized = value.replace(/\./g, '').replace(',', '.')
    const n = Number(normalized)
    return Number.isFinite(n) && n > 0 ? n : null
  }

  const parseDate = (value: string): string | null => {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
    if (!match) return null
    const day = Number(match[1])
    const month = Number(match[2])
    const year = Number(match[3])
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const d = new Date(iso)
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null
    return iso
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!parseAmount(amount)) errs.amount = 'Informe um valor válido (maior que zero)'
    if (!parseDate(paymentDate)) errs.paymentDate = 'Data inválida (use dd/mm/aaaa)'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    if (receiptError) return
    setLoading(true)
    try {
      const parsedAmount = parseAmount(amount)
      const isoDate = parseDate(paymentDate)
      if (!parsedAmount || !isoDate) return
      await onConfirm({
        amount: parsedAmount,
        paymentDate: isoDate,
        paymentMethod,
        notes: notes || undefined,
        receipt: receipt || undefined,
      })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  if (!fee) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar Pagamento">
      <div className="space-y-4">
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
          <p className="text-sm font-medium text-text">{fee.passengerName}</p>
          <p className="text-xs text-gray-400 mt-1">
            Competência: {String(fee.month).padStart(2, '0')}/{fee.year}
          </p>
        </div>

        <Input
          label="Valor pago (R$)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={errors.amount}
          placeholder="0,00"
          inputMode="decimal"
        />
        <Input
          label="Data do pagamento"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          error={errors.paymentDate}
          placeholder="dd/mm/aaaa"
        />
        <Select
          label="Forma de pagamento"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          options={paymentMethodOptions}
        />
        <Textarea
          label="Observação"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />

        <div>
          <p className="block text-sm font-medium text-text mb-1.5">Comprovante (opcional)</p>
          {receipt ? (
            <div className="flex items-center gap-3 rounded-xl border border-success/20 bg-success/5 p-3">
              {receiptPreview && receiptName.toLowerCase().endsWith('.pdf') ? (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-error/10 text-error shrink-0">
                  <FileText className="h-6 w-6" />
                </div>
              ) : (
                <img src={receiptPreview || receipt} alt="Comprovante" className="h-14 w-14 rounded-lg object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text truncate">{receiptName}</p>
                <p className="text-xs text-success">Anexado</p>
              </div>
              <button
                type="button"
                onClick={() => { setReceipt(''); setReceiptName(''); setReceiptPreview(''); setReceiptError('') }}
                className="h-9 w-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-error transition-colors"
                aria-label="Remover comprovante"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-6 cursor-pointer hover:border-primary dark:hover:border-primary transition-colors">
              <div className="flex items-center gap-2 text-primary">
                <Upload className="h-5 w-5" />
                <span className="text-sm font-medium">Enviar arquivo</span>
              </div>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <ImageIcon className="h-3 w-3" /> JPG, PNG ou PDF, até 5MB
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </label>
          )}
          {receiptError && (
            <p className="mt-1 text-sm text-error" role="alert">{receiptError}</p>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" fullWidth onClick={onClose}>
            Cancelar
          </Button>
          <Button fullWidth loading={loading} onClick={handleSubmit}>
            Confirmar
          </Button>
        </div>
      </div>
    </Modal>
  )
}