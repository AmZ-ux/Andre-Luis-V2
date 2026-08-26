import type { Passenger, PassengerFilters, SortState } from '../types/passenger'
import { config } from '../config'
import { realPassengers } from './realApi'

const STORAGE_KEY = 'mock_passengers'

const mockCities = [
  'São Paulo', 'Guarulhos', 'Campinas', 'São Bernardo', 'Santo André',
  'Osasco', 'Sorocaba', 'Ribeirão Preto', 'Jundiaí', 'Santos',
]

const mockInstitutions = [
  'USP', 'UNESP', 'UNICAMP', 'FGV', 'Mackenzie', 'PUC-SP',
  'Colégio Bandeirantes', 'Colégio Santa Maria', 'Colégio São Luís',
  'Empresa ABC Ltda', 'Tech Solutions SA', 'Comércio XYZ',
]

const firstNames = [
  'Ana', 'Carlos', 'Mariana', 'João', 'Lucia', 'Pedro', 'Camila',
  'Roberto', 'Juliana', 'Fernando', 'Amanda', 'Lucas', 'Patrícia',
  'Gustavo', 'Beatriz', 'Rafael', 'Isabela', 'Thiago', 'Larissa', 'Bruno',
]

const lastNames = [
  'Silva', 'Oliveira', 'Santos', 'Pereira', 'Costa', 'Souza', 'Lima',
  'Alves', 'Ferreira', 'Rodrigues', 'Martins', 'Barbosa', 'Ribeiro',
  'Gomes', 'Carvalho', 'Araújo', 'Mendes', 'Dias', 'Teixeira', 'Nunes',
]

function generateCPF(): string {
  const n = () => Math.floor(Math.random() * 9)
  const digits = Array.from({ length: 9 }, n)
  const calc = (d: number[]) => {
    const sum = d.reduce((a, v, i) => a + v * (d.length + 1 - i), 0)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  digits.push(calc(digits))
  digits.push(calc(digits))
  const d = digits.join('')
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function generateMockPassengers(count: number): Passenger[] {
  return Array.from({ length: count }, (_, i) => {
    const firstName = randomItem(firstNames)
    const lastName = randomItem(lastNames)
    const statuses: Passenger['status'][] = ['active', 'active', 'active', 'active', 'inactive', 'vacation', 'blocked']
    const transportTypes: Passenger['transportType'][] = ['university', 'school', 'contract']
    const methods: Passenger['paymentMethod'][] = ['pix', 'cash', 'transfer', 'card']
    const city = randomItem(mockCities)
    const institution = randomItem(mockInstitutions)
    const day = randomInt(1, 28)
    const month = randomInt(1, 12)
    const year = randomInt(1990, 2005)

    return {
      id: `p-${i + 1}`,
      name: `${firstName} ${lastName}`,
      cpf: generateCPF(),
      rg: `${randomInt(10, 99)}.${randomInt(100, 999)}.${randomInt(100, 999)}-${randomInt(0, 9)}`,
      birthDate: `${pad(day)}/${pad(month)}/${year}`,
      phone: `(${pad(randomInt(11, 99))}) ${randomInt(1000, 9999)}-${randomInt(1000, 9999)}`,
      whatsapp: `(${pad(randomInt(11, 99))}) ${randomInt(1000, 9999)}-${randomInt(1000, 9999)}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com`,
      address: {
        zipCode: `${randomInt(10000, 99999)}-${randomInt(100, 999)}`,
        street: `Rua ${randomItem(['das Flores', 'dos Anjos', 'Vergueiro', 'Paulista', 'Amazonas', 'Bahia', 'Progresso'])}`,
        number: String(randomInt(1, 9999)),
        complement: i % 3 === 0 ? `Apto ${randomInt(1, 100)}` : '',
        neighborhood: randomItem(['Centro', 'Vila Nova', 'Jardim', 'Liberdade', 'Bela Vista', 'Barra Funda']),
        city,
        state: 'SP',
      },
      transportType: randomItem(transportTypes),
      institution: institution,
      course: i % 3 === 0 ? 'Administração' : i % 3 === 1 ? 'Engenharia' : 'Direito',
      class: `Turma ${String.fromCharCode(65 + randomInt(0, 5))}`,
      company: i % 2 === 0 ? institution : undefined,
      school: i % 2 === 0 ? undefined : institution,
      workplace: i % 2 === 0 ? undefined : `Empresa ${lastName} Ltda`,
      monthlyFee: randomInt(120, 350),
      dueDay: randomInt(1, 28),
      paymentMethod: randomItem(methods),
      status: randomItem(statuses),
      notes: i % 5 === 0 ? 'Passageiro com necessidades especiais de embarque' : '',
      createdAt: new Date(2026, randomInt(0, 6), randomInt(1, 28)).toLocaleDateString('pt-BR'),
      updatedAt: new Date().toLocaleDateString('pt-BR'),
    }
  })
}

function loadPassengers(): Passenger[] {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) return JSON.parse(stored) as Passenger[]
  const generated = generateMockPassengers(28)
  const demo: Passenger = {
    id: '2',
    name: 'Maria Oliveira',
    cpf: '111.111.111-11',
    rg: '12.345.678-9',
    birthDate: '12/04/2004',
    phone: '(11) 99999-7777',
    whatsapp: '(11) 99999-7777',
    email: 'passageiro@transporte.com',
    address: {
      zipCode: '01310-100',
      street: 'Rua Vergueiro',
      number: '1000',
      complement: 'Apto 42',
      neighborhood: 'Paraíso',
      city: 'São Paulo',
      state: 'SP',
    },
    transportType: 'university',
    institution: 'USP',
    course: 'Administração',
    class: 'Turma A',
    monthlyFee: 250,
    dueDay: 10,
    paymentMethod: 'pix',
    status: 'active',
    notes: '',
    createdAt: '15/03/2026',
    updatedAt: new Date().toLocaleDateString('pt-BR'),
  }
  generated.unshift(demo)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(generated))
  return generated
}

function savePassengers(passengers: Passenger[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(passengers))
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export const passengerService = {
  async list(
    filters: PassengerFilters,
    sort: SortState,
    page: number,
    pageSize: number
  ): Promise<{ data: Passenger[]; total: number }> {
    if (config.realApi) return realPassengers.list(filters, sort, page, pageSize)
    await delay(400)
    let data = loadPassengers()

    if (filters.search) {
      const q = filters.search.toLowerCase()
      data = data.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.cpf.includes(q) ||
          p.phone.includes(q) ||
          p.email?.toLowerCase().includes(q) ||
          p.institution?.toLowerCase().includes(q) ||
          p.company?.toLowerCase().includes(q) ||
          p.school?.toLowerCase().includes(q)
      )
    }

    if (filters.status) data = data.filter((p) => p.status === filters.status)
    if (filters.transportType) data = data.filter((p) => p.transportType === filters.transportType)
    if (filters.city) data = data.filter((p) => p.address.city.toLowerCase().includes(filters.city.toLowerCase()))
    if (filters.institution) data = data.filter((p) => p.institution?.toLowerCase().includes(filters.institution.toLowerCase()))
    if (filters.company) data = data.filter((p) => p.company?.toLowerCase().includes(filters.company.toLowerCase()))
    if (filters.dueDay) data = data.filter((p) => p.dueDay === parseInt(filters.dueDay))

    data.sort((a, b) => {
      const dir = sort.direction === 'asc' ? 1 : -1
      const fields = {
        name: a.name.localeCompare(b.name) * dir,
        createdAt: a.createdAt.localeCompare(b.createdAt) * dir,
        city: a.address.city.localeCompare(b.address.city) * dir,
        monthlyFee: (a.monthlyFee - b.monthlyFee) * dir,
        dueDay: (a.dueDay - b.dueDay) * dir,
      }
      return fields[sort.field] || 0
    })

    const total = data.length
    const start = (page - 1) * pageSize
    const paged = data.slice(start, start + pageSize)

    return { data: paged, total }
  },

  async getById(id: string): Promise<Passenger | null> {
    if (config.realApi) return realPassengers.getById(id)
    await delay(200)
    const data = loadPassengers()
    return data.find((p) => p.id === id) || null
  },

  // Self-service: carrega o cadastro do passageiro autenticado (rota /passengers/me).
  async getMe(): Promise<Passenger | null> {
    if (config.realApi) return realPassengers.getMe()
    await delay(200)
    return null
  },

  async create(
    passenger: Omit<Passenger, 'id' | 'createdAt' | 'updatedAt'>,
    options?: { id?: string }
  ): Promise<Passenger> {
    if (config.realApi) return realPassengers.create(passenger)
    await delay(500)
    const data = loadPassengers()
    const newPassenger: Passenger = {
      ...passenger,
      id: options?.id || `p-${Date.now()}`,
      createdAt: new Date().toLocaleDateString('pt-BR'),
      updatedAt: new Date().toLocaleDateString('pt-BR'),
    }
    data.unshift(newPassenger)
    savePassengers(data)
    return newPassenger
  },

  async update(id: string, updates: Partial<Passenger>): Promise<Passenger> {
    if (config.realApi) return realPassengers.update(id, updates)
    await delay(500)
    const data = loadPassengers()
    const idx = data.findIndex((p) => p.id === id)
    if (idx === -1) throw new Error('Passageiro não encontrado')
    data[idx] = { ...data[idx], ...updates, updatedAt: new Date().toLocaleDateString('pt-BR') }
    savePassengers(data)
    return data[idx]
  },

  async remove(id: string): Promise<void> {
    if (config.realApi) return realPassengers.remove(id)
    await delay(300)
    const data = loadPassengers()
    savePassengers(data.filter((p) => p.id !== id))
  },
}
