import { storage } from './storage'
import { config } from '../config'
import { realMonthlyFees } from './realApi'
import type {
  MonthlyFee,
  MonthlyFeeFilters,
  MonthlyFeeSort,
  Payment,
} from '../types/monthlyFee'

const STORAGE_KEY = 'mock_monthly_fees'
const PAYMENTS_KEY = 'mock_payments'

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function loadFees(): MonthlyFee[] {
  const stored = storage.get<MonthlyFee[]>(STORAGE_KEY)
  if (stored) return stored
  const seeded = seedDemoFees()
  saveFees(seeded)
  return seeded
}

function seedDemoFees(): MonthlyFee[] {
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const prev1 = new Date(currentYear, now.getMonth() - 1, 1)
  const prev2 = new Date(currentYear, now.getMonth() - 2, 1)

  const fee = (month: number, year: number, status: MonthlyFee['status']): MonthlyFee => ({
    id: `mf-demo-${year}-${month}`,
    passengerId: '2',
    passengerName: 'Maria Oliveira',
    cpf: '111.111.111-11',
    transportType: 'university',
    institution: 'USP',
    month,
    year,
    amount: 250,
    dueDay: 10,
    dueDate: `10/${String(month).padStart(2, '0')}/${year}`,
    status,
    createdAt: new Date(year, month - 1, 5).toLocaleDateString('pt-BR'),
    updatedAt: new Date(year, month - 1, 12).toLocaleDateString('pt-BR'),
  })

  const p1 = prev1.getMonth() + 1
  const p2 = prev2.getMonth() + 1

  return [
    fee(currentMonth, currentYear, 'pending'),
    fee(p1, prev1.getFullYear(), 'paid'),
    fee(p2, prev2.getFullYear(), 'paid'),
  ]
}

function loadPayments(): Payment[] {
  const stored = storage.get<Payment[]>(PAYMENTS_KEY)
  if (stored) return stored

  const fees = loadFees()
  const now = new Date()
  const prev1 = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prev2 = new Date(now.getFullYear(), now.getMonth() - 2, 1)

  const payment = (fee: MonthlyFee | undefined, day: number, month: number, year: number): Payment | null => {
    if (!fee) return null
    return {
      id: `pay-demo-${year}-${month}`,
      monthlyFeeId: fee.id,
      amount: fee.amount,
      paymentDate: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
      paymentMethod: 'pix',
      createdAt: new Date(year, month - 1, day).toLocaleDateString('pt-BR'),
    }
  }

  const seeded = [
    payment(fees.find((f) => f.month === prev1.getMonth() + 1), 10, prev1.getMonth() + 1, prev1.getFullYear()),
    payment(fees.find((f) => f.month === prev2.getMonth() + 1), 9, prev2.getMonth() + 1, prev2.getFullYear()),
  ].filter((p): p is Payment => p !== null)

  savePayments(seeded)
  return seeded
}

function saveFees(fees: MonthlyFee[]): void {
  storage.set(STORAGE_KEY, fees)
}

function savePayments(payments: Payment[]): void {
  storage.set(PAYMENTS_KEY, payments)
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export const monthlyFeeService = {
  async list(
    filters: MonthlyFeeFilters,
    sort: MonthlyFeeSort,
    page: number,
    pageSize: number
  ): Promise<{ data: MonthlyFee[]; total: number }> {
    if (config.realApi) return realMonthlyFees.list(filters, sort, page, pageSize)
    await delay(400)
    let data = loadFees()
    const paymentsMap = new Map<string, Payment>()
    loadPayments().forEach((p) => paymentsMap.set(p.monthlyFeeId, p))

    data = data.map((fee) => ({
      ...fee,
      payment: paymentsMap.get(fee.id) || undefined,
    }))

    if (filters.search) {
      const q = filters.search.toLowerCase()
      data = data.filter(
        (f) =>
          f.passengerName.toLowerCase().includes(q) ||
          f.cpf.includes(q) ||
          f.institution?.toLowerCase().includes(q) ||
          f.company?.toLowerCase().includes(q) ||
          String(f.month).includes(q) ||
          String(f.year).includes(q)
      )
    }

    if (filters.month) {
      data = data.filter((f) => f.month === parseInt(filters.month))
    }
    if (filters.year) {
      data = data.filter((f) => f.year === parseInt(filters.year))
    }
    if (filters.status) {
      data = data.filter((f) => f.status === filters.status)
    }
    if (filters.transportType) {
      data = data.filter((f) => f.transportType === filters.transportType)
    }
    if (filters.passenger) {
      const q = filters.passenger.toLowerCase()
      data = data.filter((f) => f.passengerName.toLowerCase().includes(q))
    }
    if (filters.dueDayStart) {
      data = data.filter((f) => f.dueDay >= parseInt(filters.dueDayStart))
    }
    if (filters.dueDayEnd) {
      data = data.filter((f) => f.dueDay <= parseInt(filters.dueDayEnd))
    }

    data.sort((a, b) => {
      const dir = sort.direction === 'asc' ? 1 : -1
      switch (sort.field) {
        case 'passengerName':
          return a.passengerName.localeCompare(b.passengerName) * dir
        case 'amount':
          return (a.amount - b.amount) * dir
        case 'dueDay':
          return (a.dueDay - b.dueDay) * dir
        case 'paymentDate': {
          const aDate = a.payment?.paymentDate || ''
          const bDate = b.payment?.paymentDate || ''
          return aDate.localeCompare(bDate) * dir
        }
        case 'createdAt':
          return a.createdAt.localeCompare(b.createdAt) * dir
        default:
          return 0
      }
    })

    const total = data.length
    const start = (page - 1) * pageSize
    const paged = data.slice(start, start + pageSize)

    return { data: paged, total }
  },

  async getById(id: string): Promise<MonthlyFee | null> {
    if (config.realApi) return realMonthlyFees.getById(id)
    await delay(200)
    const fees = loadFees()
    const payments = loadPayments()
    const fee = fees.find((f) => f.id === id) || null
    if (fee) {
      const payment = payments.find((p) => p.monthlyFeeId === id)
      if (payment) fee.payment = payment
    }
    return fee
  },

  async getByPassengerId(passengerId: string): Promise<MonthlyFee[]> {
    if (config.realApi) return realMonthlyFees.getByPassengerId(passengerId)
    await delay(200)
    await this.ensureContractFees(passengerId)
    const fees = loadFees()
    const payments = loadPayments()
    return fees
      .filter((f) => f.passengerId === passengerId)
      .map((fee) => {
        const payment = payments.find((p) => p.monthlyFeeId === fee.id)
        return payment ? { ...fee, payment } : fee
      })
  },

  async ensureContractFees(passengerId: string): Promise<void> {
    const { passengerService } = await import('./passengerService')
    const passenger = await passengerService.getById(passengerId)
    if (!passenger || passenger.status !== 'active') return

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    let startMonth = currentMonth
    let startYear = currentYear
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(passenger.contractStartDate || '')
    if (match) {
      const start = new Date(Number(match[1]), Number(match[2]) - 1, 1)
      if (start.getTime() <= now.getTime()) {
        startMonth = start.getMonth() + 1
        startYear = start.getFullYear()
      }
    }

    const existingKeys = new Set(
      loadFees()
        .filter((f) => f.passengerId === passengerId)
        .map((f) => `${f.year}-${f.month}`)
    )

    let month = startMonth
    let year = startYear
    while (year < currentYear || (year === currentYear && month <= currentMonth)) {
      if (!existingKeys.has(`${year}-${month}`)) {
        await this.create({
          passengerId,
          passengerName: passenger.name,
          cpf: passenger.cpf,
          transportType: passenger.transportType,
          institution: passenger.institution,
          company: passenger.company,
          month,
          year,
          amount: passenger.monthlyFee,
          dueDay: passenger.dueDay,
        })
      }
      month++
      if (month > 12) {
        month = 1
        year++
      }
    }
  },

  async exists(passengerId: string, month: number, year: number): Promise<boolean> {
    const fees = loadFees()
    return fees.some((f) => f.passengerId === passengerId && f.month === month && f.year === year)
  },

  async create(
    data: Omit<MonthlyFee, 'id' | 'status' | 'payment' | 'createdAt' | 'updatedAt' | 'dueDate'>
  ): Promise<MonthlyFee> {
    if (config.realApi) return realMonthlyFees.create(data)
    await delay(300)
    const fees = loadFees()
    const fee: MonthlyFee = {
      ...data,
      id: `mf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      status: 'pending',
      dueDate: `${pad(data.dueDay)}/${pad(data.month)}/${data.year}`,
      createdAt: new Date().toLocaleDateString('pt-BR'),
      updatedAt: new Date().toLocaleDateString('pt-BR'),
    }
    fees.unshift(fee)
    saveFees(fees)
    return fee
  },

  async update(id: string, updates: Partial<MonthlyFee>): Promise<MonthlyFee> {
    if (config.realApi) return realMonthlyFees.update(id, updates)
    await delay(300)
    const fees = loadFees()
    const idx = fees.findIndex((f) => f.id === id)
    if (idx === -1) throw new Error('Mensalidade não encontrada')
    fees[idx] = {
      ...fees[idx],
      ...updates,
      dueDate: updates.dueDay
        ? `${pad(updates.dueDay)}/${pad(fees[idx].month)}/${fees[idx].year}`
        : fees[idx].dueDate,
      updatedAt: new Date().toLocaleDateString('pt-BR'),
    }
    saveFees(fees)
    return fees[idx]
  },

  async remove(id: string): Promise<void> {
    if (config.realApi) return realMonthlyFees.remove(id)
    await delay(200)
    const fees = loadFees()
    saveFees(fees.filter((f) => f.id !== id))
  },

  async ensureCurrent(): Promise<{ next: MonthlyFee | null; created: number }> {
    if (config.realApi) return realMonthlyFees.ensureCurrent()
    const { sessionManager } = await import('../auth/sessionManager')
    const session = sessionManager.load()
    if (!session?.user) throw new Error('Não autenticado')
    await this.ensureContractFees(session.user.id)
    const fees = loadFees()
      .filter((f) => f.passengerId === session.user!.id)
      .sort((a, b) => (a.year - b.year) || (a.month - b.month))
    const next = fees.find((f) => f.status === 'pending' || f.status === 'overdue') || fees[fees.length - 1] || null
    return { next, created: 0 }
  },
}
