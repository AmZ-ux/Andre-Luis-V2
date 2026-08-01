import { storage } from './storage'
import { receiptHistory } from './receiptHistory'
import { config } from '../config'
import { realReceipts } from './realApi'
import type { Receipt, ReceiptFilters, ReceiptSort, ReceiptSummary } from '../types/receipt'
import type { TransportType } from '../types/passenger'

const RECEIPTS_KEY = 'mock_receipts'

const DEMO_PIX_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function loadReceipts(): Receipt[] {
  const stored = storage.get<Receipt[]>(RECEIPTS_KEY)
  if (stored) return stored
  const seeded = seedDemoReceipts()
  if (seeded.length > 0) saveReceipts(seeded)
  return seeded
}

function seedDemoReceipts(): Receipt[] {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  return [
    {
      id: 'rcpt-demo-current',
      monthlyFeeId: `mf-demo-${year}-${month}`,
      passengerId: '2',
      passengerName: 'Maria Oliveira',
      cpf: '111.111.111-11',
      transportType: 'university',
      institution: 'USP',
      month,
      year,
      amount: 250,
      fileName: 'comprovante-pix.png',
      fileType: 'image/png',
      fileData: DEMO_PIX_PNG,
      fileSize: 67,
      status: 'awaiting',
      createdAt: new Date().toLocaleString('pt-BR'),
      updatedAt: new Date().toLocaleString('pt-BR'),
    },
  ]
}

function saveReceipts(receipts: Receipt[]): void {
  storage.set(RECEIPTS_KEY, receipts)
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteChars = atob(base64)
  const bytes = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
  return new Blob([bytes], { type: mimeType })
}

function toFormData(data: Record<string, any>, file: { name: string; type: string; data: string }): FormData {
  const form = new FormData()
  form.append('file', base64ToBlob(file.data, file.type), file.name)
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) form.append(key, String(value))
  }
  return form
}

export const receiptService = {
  async list(
    filters: ReceiptFilters,
    sort: ReceiptSort,
    page: number,
    pageSize: number
  ): Promise<{ data: Receipt[]; total: number }> {
    if (config.realApi) return realReceipts.list(filters, page, pageSize)
    await delay(300)
    let data = loadReceipts()

    if (filters.search) {
      const q = filters.search.toLowerCase()
      data = data.filter(
        (r) =>
          r.passengerName.toLowerCase().includes(q) ||
          r.cpf.includes(q) ||
          `${r.month}`.includes(q) ||
          `${r.year}`.includes(q)
      )
    }

    if (filters.status) {
      data = data.filter((r) => r.status === filters.status)
    }
    if (filters.month) {
      data = data.filter((r) => r.month === parseInt(filters.month))
    }
    if (filters.year) {
      data = data.filter((r) => r.year === parseInt(filters.year))
    }
    if (filters.transportType) {
      data = data.filter((r) => r.transportType === filters.transportType)
    }

    data.sort((a, b) => {
      const dir = sort.direction === 'asc' ? 1 : -1
      switch (sort.field) {
        case 'passengerName':
          return a.passengerName.localeCompare(b.passengerName) * dir
        case 'createdAt':
          return a.createdAt.localeCompare(b.createdAt) * dir
        case 'amount':
          return (a.amount - b.amount) * dir
        case 'status':
          return a.status.localeCompare(b.status) * dir
        default:
          return 0
      }
    })

    const total = data.length
    const start = (page - 1) * pageSize
    const paged = data.slice(start, start + pageSize)

    return { data: paged, total }
  },

  async getById(id: string): Promise<Receipt | null> {
    if (config.realApi) {
      const res = await realReceipts.getWithHistory(id)
      return res.receipt
    }
    await delay(200)
    return loadReceipts().find((r) => r.id === id) || null
  },

  async getByMonthlyFeeId(monthlyFeeId: string): Promise<Receipt | null> {
    const receipts = loadReceipts()
    return receipts.find((r) => r.monthlyFeeId === monthlyFeeId) || null
  },

  async getByPassengerId(passengerId: string): Promise<Receipt[]> {
    if (config.realApi) return realReceipts.getByPassengerId(passengerId)
    return loadReceipts().filter((r) => r.passengerId === passengerId)
  },

  async create(data: {
    monthlyFeeId: string
    passengerId: string
    passengerName: string
    cpf: string
    transportType: TransportType
    institution?: string
    company?: string
    month: number
    year: number
    amount: number
    fileName: string
    fileType: string
    fileData: string
    fileSize: number
    submittedBy: string
    submittedById: string
  }): Promise<Receipt> {
    if (config.realApi) {
      const form = toFormData(
        {
          monthlyFeeId: data.monthlyFeeId,
          passengerId: data.passengerId,
          passengerName: data.passengerName,
          cpf: data.cpf,
          transportType: data.transportType,
          institution: data.institution || '',
          company: data.company || '',
          month: data.month,
          year: data.year,
          amount: data.amount,
          submittedBy: data.submittedBy,
          submittedById: data.submittedById,
        },
        { name: data.fileName, type: data.fileType, data: data.fileData }
      )
      return realReceipts.create(form)
    }

    await delay(400)

    const existing = await this.getByMonthlyFeeId(data.monthlyFeeId)
    if (existing && existing.status === 'awaiting') {
      throw new Error('Esta mensalidade já possui um comprovante em análise. Aguarde a análise ou substitua o comprovante existente.')
    }

    const receipt: Receipt = {
      id: `rcpt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      monthlyFeeId: data.monthlyFeeId,
      passengerId: data.passengerId,
      passengerName: data.passengerName,
      cpf: data.cpf,
      transportType: data.transportType,
      institution: data.institution,
      company: data.company,
      month: data.month,
      year: data.year,
      amount: data.amount,
      fileName: data.fileName,
      fileType: data.fileType,
      fileData: data.fileData,
      fileSize: data.fileSize,
      status: 'awaiting',
      createdAt: new Date().toLocaleString('pt-BR'),
      updatedAt: new Date().toLocaleString('pt-BR'),
    }

    const receipts = loadReceipts()
    receipts.unshift(receipt)
    saveReceipts(receipts)

    await receiptHistory.add(receipt.id, 'created', data.submittedBy, data.submittedById)

    return receipt
  },

  async update(id: string, updates: Partial<Receipt>): Promise<Receipt> {
    await delay(200)
    const receipts = loadReceipts()
    const idx = receipts.findIndex((r) => r.id === id)
    if (idx === -1) throw new Error('Comprovante não encontrado')
    receipts[idx] = {
      ...receipts[idx],
      ...updates,
      updatedAt: new Date().toLocaleString('pt-BR'),
    }
    saveReceipts(receipts)
    return receipts[idx]
  },

  async replace(
    id: string,
    newFile: {
      fileName: string
      fileType: string
      fileData: string
      fileSize: number
    },
    submittedBy: string,
    submittedById: string
  ): Promise<Receipt> {
    if (config.realApi) {
      const form = toFormData(
        { submittedBy, submittedById },
        { name: newFile.fileName, type: newFile.fileType, data: newFile.fileData }
      )
      return realReceipts.replace(id, form)
    }
    await delay(400)
    const receipt = await this.getById(id)
    if (!receipt) throw new Error('Comprovante não encontrado')
    if (receipt.status !== 'awaiting') throw new Error('Só é possível substituir comprovantes não analisados')

    const updated = await this.update(id, {
      fileName: newFile.fileName,
      fileType: newFile.fileType,
      fileData: newFile.fileData,
      fileSize: newFile.fileSize,
      status: 'awaiting',
      reviewedBy: undefined,
      reviewDate: undefined,
      reviewNotes: undefined,
    })

    await receiptHistory.add(id, 'replaced', submittedBy, submittedById)

    return updated
  },

  async getSummary(): Promise<ReceiptSummary> {
    if (config.realApi) {
      const s = await realReceipts.summary()
      return { awaiting: s.awaiting, approved: s.approved, rejected: s.rejected, cancelled: s.cancelled, total: s.total }
    }
    const receipts = loadReceipts()
    return {
      awaiting: receipts.filter((r) => r.status === 'awaiting').length,
      approved: receipts.filter((r) => r.status === 'approved').length,
      rejected: receipts.filter((r) => r.status === 'rejected').length,
      cancelled: receipts.filter((r) => r.status === 'cancelled').length,
      total: receipts.length,
    }
  },

  async remove(id: string): Promise<void> {
    await delay(200)
    const receipts = loadReceipts()
    saveReceipts(receipts.filter((r) => r.id !== id))
  },
}
