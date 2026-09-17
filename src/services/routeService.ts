import type { Route, RouteFormData } from '../types/route'
import { config } from '../config'
import { realRoutes } from './realApi'

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const mockRoutes: Route[] = [
  { id: '1', origin: 'Ipiranga do Piauí', destination: 'Universidade Federal', monthlyAmount: 400, active: true, createdAt: '2026-09-01', updatedAt: '2026-09-01' },
  { id: '2', origin: 'Ipiranga do Piauí', destination: 'IFPI', monthlyAmount: 350, active: true, createdAt: '2026-09-01', updatedAt: '2026-09-01' },
]

export const routeService = {
  async list(): Promise<Route[]> {
    if (config.realApi) return realRoutes.list()
    await delay(300)
    return mockRoutes.filter((r) => r.active)
  },

  async listAll(): Promise<Route[]> {
    if (config.realApi) return realRoutes.listAll()
    await delay(300)
    return [...mockRoutes]
  },

  async getById(id: string): Promise<Route> {
    if (config.realApi) return realRoutes.getById(id)
    await delay(200)
    const route = mockRoutes.find((r) => r.id === id)
    if (!route) throw new Error('Rota não encontrada')
    return route
  },

  async create(data: RouteFormData): Promise<Route> {
    if (config.realApi) return realRoutes.create(data)
    await delay(400)
    const exists = mockRoutes.some(
      (r) => r.origin.toLowerCase() === data.origin.toLowerCase() && r.destination.toLowerCase() === data.destination.toLowerCase()
    )
    if (exists) throw new Error('Já existe uma rota com esta origem e destino')
    const newRoute: Route = {
      id: String(mockRoutes.length + 1),
      origin: data.origin,
      destination: data.destination,
      monthlyAmount: data.monthlyAmount,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    mockRoutes.push(newRoute)
    return newRoute
  },

  async update(id: string, data: Partial<RouteFormData>): Promise<Route> {
    if (config.realApi) return realRoutes.update(id, data)
    await delay(400)
    const idx = mockRoutes.findIndex((r) => r.id === id)
    if (idx === -1) throw new Error('Rota não encontrada')
    mockRoutes[idx] = { ...mockRoutes[idx], ...data, updatedAt: new Date().toISOString() }
    return mockRoutes[idx]
  },

  async deactivate(id: string): Promise<void> {
    if (config.realApi) return realRoutes.deactivate(id)
    await delay(300)
    const idx = mockRoutes.findIndex((r) => r.id === id)
    if (idx !== -1) mockRoutes[idx].active = false
  },
}
