import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../auth/AuthContext'
import { motion } from 'framer-motion'
import { receiptService } from '../services/receiptService'
import { monthlyFeeService } from '../services/monthlyFeeService'
import { receiptValidation } from '../services/receiptValidation'
import { ReceiptCard } from '../components/receipts/ReceiptCard'
import { ReceiptUpload } from '../components/receipts/ReceiptUpload'
import { ReceiptViewer } from '../components/receipts/ReceiptViewer'
import { ReplaceReceiptModal } from '../components/receipts/ReplaceReceiptModal'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { useToast } from '../contexts/ToastContext'
import { PageSpinner } from '../components/ui/Spinner'
import { Plus, ReceiptText } from 'lucide-react'
import type { Receipt } from '../types/receipt'
import type { MonthlyFee } from '../types/monthlyFee'

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function MeusComprovantes() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [fees, setFees] = useState<MonthlyFee[]>([])
  const [selectedMonth, setSelectedMonth] = useState('')
  const [selectedFee, setSelectedFee] = useState<MonthlyFee | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [viewingReceipt, setViewingReceipt] = useState<Receipt | null>(null)
  const [replacingReceipt, setReplacingReceipt] = useState<Receipt | null>(null)

  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setLoadError(null)
    try {
      const [rcpts, mf] = await Promise.all([
        receiptService.getByPassengerId(user.id),
        monthlyFeeService.getByPassengerId(user.id),
      ])
      setReceipts(rcpts)
      setFees(mf.filter((f) => f.status === 'pending' || f.status === 'overdue'))
    } catch {
      setLoadError('Erro ao carregar comprovantes')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const handleMonthChange = (key: string) => {
    setSelectedMonth(key)
    if (key) {
      const [year, month] = key.split('-').map(Number)
      const fee = payableFees.find((f) => f.month === month && f.year === year)
      setSelectedFee(fee || null)
    } else {
      setSelectedFee(null)
    }
  }

  const handleFileSelect = useCallback((f: File) => {
    setFile(f)
    setUploadError(null)
    if (f.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => setPreviewData(reader.result as string)
      reader.readAsDataURL(f)
    } else {
      setPreviewData(null)
    }
  }, [])

  const handleRemoveFile = useCallback(() => {
    setFile(null)
    setPreviewData(null)
    setUploadError(null)
  }, [])

  const handleUpload = async () => {
    if (!file || !selectedFee || !user) return
    setUploading(true)
    setUploadError(null)
    try {
      const fileData = await receiptValidation.fileToBase64(file)
      await receiptService.create({
        monthlyFeeId: selectedFee.id,
        passengerId: user.id,
        passengerName: user.name,
        cpf: user.cpf,
        transportType: selectedFee.transportType,
        institution: selectedFee.institution,
        company: selectedFee.company,
        month: selectedFee.month,
        year: selectedFee.year,
        amount: selectedFee.amount,
        fileName: file.name,
        fileType: file.type,
        fileData,
        fileSize: file.size,
        submittedBy: user.name,
        submittedById: user.id,
      })
      addToast('success', 'Comprovante enviado com sucesso!')
      setShowUpload(false)
      setFile(null)
      setPreviewData(null)
      setSelectedMonth('')
      setSelectedFee(null)
      const rcpts = await receiptService.getByPassengerId(user.id)
      setReceipts(rcpts)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Erro ao enviar comprovante')
    } finally {
      setUploading(false)
    }
  }

  const handleReplace = useCallback(async (newFile: File) => {
    if (!replacingReceipt || !user) return
    const fileData = await receiptValidation.fileToBase64(newFile)
    await receiptService.replace(
      replacingReceipt.id,
      { fileName: newFile.name, fileType: newFile.type, fileData, fileSize: newFile.size },
      user.name,
      user.id
    )
    addToast('success', 'Comprovante substituído com sucesso!')
    setReplacingReceipt(null)
    const rcpts = await receiptService.getByPassengerId(user.id)
    setReceipts(rcpts)
  }, [replacingReceipt, user, addToast])

  if (loading) return <PageSpinner />

  const awaitingReceiptKeys = new Set(
    receipts.filter((r) => r.status === 'awaiting').map((r) => `${r.year}-${r.month}`)
  )
  const payableFees = fees.filter((f) => !awaitingReceiptKeys.has(`${f.year}-${f.month}`))

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16">
        <div className="h-16 w-16 rounded-2xl bg-error/10 flex items-center justify-center mb-4">
          <span className="text-2xl text-error">!</span>
        </div>
        <h2 className="text-lg font-semibold text-text mb-1">Erro ao carregar</h2>
        <p className="text-sm text-gray-500 mb-6">{loadError}</p>
        <button onClick={load} className="h-11 px-5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-light transition-colors">
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-3xl mx-auto"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text">Meus Comprovantes</h1>
          <p className="text-sm text-gray-500 mt-1">Envie e acompanhe seus comprovantes de pagamento</p>
        </div>
        {!showUpload && (
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setShowUpload(true)}
          >
            Novo Envio
          </Button>
        )}
      </div>

      {showUpload && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-text">Enviar Comprovante</h2>
            <button
              onClick={() => { setShowUpload(false); handleRemoveFile() }}
              className="text-sm text-gray-400 hover:text-text transition-colors"
            >
              Cancelar
            </button>
          </div>

          <div className="space-y-4">
            {payableFees.length === 0 ? (
              <div className="text-center py-10 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                <div className="h-14 w-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                  <ReceiptText className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-text">Nenhuma mensalidade disponível</p>
                <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                  {awaitingReceiptKeys.size > 0
                    ? 'Seus comprovantes enviados estão em análise. Assim que a administração confirmar, novas mensalidades ficarão disponíveis.'
                    : 'Ainda não há mensalidades lançadas para você. A administração faz o lançamento — assim que houver, você poderá enviar o comprovante aqui.'}
                </p>
              </div>
            ) : (
              <>
                <Select
                  label="Selecione a mensalidade"
                  options={[
                    { value: '', label: 'Selecione o mês' },
                    ...payableFees.map((f) => ({
                      value: `${f.year}-${f.month}`,
                      label: `${monthNames[f.month - 1]}/${f.year}`,
                    })),
                  ]}
                  value={selectedMonth}
                  onChange={(e) => handleMonthChange(e.target.value)}
                  placeholder="Mês"
                />

                {selectedFee && (
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                    <p className="text-sm text-gray-500">Mensalidade selecionada</p>
                    <p className="text-sm font-semibold text-text">
                      {String(selectedFee.month).padStart(2, '0')}/{selectedFee.year}
                    </p>
                    <p className="text-lg font-bold text-primary mt-1">
                      R$ {selectedFee.amount.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                )}

                {selectedFee && !selectedFee.amount && (
                  <div className="bg-warning/10 border border-warning/20 rounded-xl px-4 py-3 text-xs text-warning-dark dark:text-warning">
                    O valor desta mensalidade ainda não foi definido. Envie o comprovante mesmo assim; a administração confirmará o valor.
                  </div>
                )}

                {selectedFee && (
                  <>
                    <ReceiptUpload
                      onFileSelect={handleFileSelect}
                      onRemove={handleRemoveFile}
                      selectedFile={file}
                      previewData={previewData}
                      error={uploadError || undefined}
                    />
                    <Button
                      fullWidth
                      loading={uploading}
                      onClick={handleUpload}
                      disabled={!file}
                    >
                      Enviar Comprovante
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </Card>
      )}

      {receipts.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-sm text-gray-400">Nenhum comprovante enviado ainda</p>
            {!showUpload && (
              <Button
                variant="secondary"
                className="mt-4"
                onClick={() => setShowUpload(true)}
              >
                Enviar Primeiro Comprovante
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {receipts.map((receipt, i) => (
            <ReceiptCard
              key={receipt.id}
              receipt={receipt}
              index={i}
              onReplace={setReplacingReceipt}
            />
          ))}
        </div>
      )}

      {viewingReceipt && (
        <ReceiptViewer receipt={viewingReceipt} onClose={() => setViewingReceipt(null)} />
      )}

      <ReplaceReceiptModal
        isOpen={!!replacingReceipt}
        onClose={() => setReplacingReceipt(null)}
        onConfirm={handleReplace}
        receipt={replacingReceipt}
      />
    </motion.div>
  )
}
