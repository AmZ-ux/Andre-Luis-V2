import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock config to use mock mode
vi.mock('../config', () => ({
  config: { realApi: false },
}))

import { routeService } from '../services/routeService'

describe('routeService (mock mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('list', () => {
    it('returns only active routes', async () => {
      const routes = await routeService.list()
      expect(routes.length).toBeGreaterThan(0)
      routes.forEach((r) => {
        expect(r.active).toBe(true)
      })
    })

    it('returns routes with required fields', async () => {
      const routes = await routeService.list()
      routes.forEach((r) => {
        expect(r).toHaveProperty('id')
        expect(r).toHaveProperty('origin')
        expect(r).toHaveProperty('destination')
        expect(r).toHaveProperty('monthlyAmount')
        expect(r).toHaveProperty('active')
        expect(typeof r.origin).toBe('string')
        expect(typeof r.destination).toBe('string')
        expect(typeof r.monthlyAmount).toBe('number')
      })
    })
  })

  describe('listAll', () => {
    it('returns all routes including inactive', async () => {
      const routes = await routeService.listAll()
      expect(Array.isArray(routes)).toBe(true)
    })
  })

  describe('getById', () => {
    it('returns a route by id', async () => {
      const routes = await routeService.list()
      const first = routes[0]
      const found = await routeService.getById(first.id)
      expect(found.id).toBe(first.id)
      expect(found.origin).toBe(first.origin)
    })

    it('throws for non-existent id', async () => {
      await expect(routeService.getById('nonexistent')).rejects.toThrow('Rota não encontrada')
    })
  })

  describe('create', () => {
    it('creates a new route', async () => {
      const route = await routeService.create({ origin: 'Origem Teste', destination: 'Destino Teste', monthlyAmount: 500 })
      expect(route.origin).toBe('Origem Teste')
      expect(route.destination).toBe('Destino Teste')
      expect(route.monthlyAmount).toBe(500)
      expect(route.active).toBe(true)
      expect(route.id).toBeDefined()
    })

    it('rejects duplicate origin+destination', async () => {
      await routeService.create({ origin: 'Dup Test', destination: 'Dup Dest', monthlyAmount: 100 })
      await expect(routeService.create({ origin: 'Dup Test', destination: 'Dup Dest', monthlyAmount: 200 })).rejects.toThrow('Já existe uma rota com esta origem e destino')
    })

    it('allows same origin with different destination', async () => {
      const r1 = await routeService.create({ origin: 'Same Origin', destination: 'Dest A', monthlyAmount: 100 })
      const r2 = await routeService.create({ origin: 'Same Origin', destination: 'Dest B', monthlyAmount: 200 })
      expect(r1.id).not.toBe(r2.id)
    })
  })

  describe('update', () => {
    it('updates a route', async () => {
      const routes = await routeService.list()
      const updated = await routeService.update(routes[0].id, { monthlyAmount: 999 })
      expect(updated.monthlyAmount).toBe(999)
    })

    it('throws for non-existent route', async () => {
      await expect(routeService.update('nonexistent', { monthlyAmount: 100 })).rejects.toThrow('Rota não encontrada')
    })
  })

  describe('deactivate', () => {
    it('deactivates a route', async () => {
      const created = await routeService.create({ origin: 'To Deactivate', destination: 'Dest', monthlyAmount: 300 })
      await routeService.deactivate(created.id)
      const all = await routeService.listAll()
      const deactivated = all.find((r) => r.id === created.id)
      expect(deactivated?.active).toBe(false)
    })
  })
})

describe('formatCurrency', () => {
  function formatCurrency(value: number): string {
    return `R$ ${value.toFixed(2).replace('.', ',')}`
  }

  it('formats whole number', () => {
    expect(formatCurrency(400)).toBe('R$ 400,00')
  })

  it('formats decimal value', () => {
    expect(formatCurrency(189.9)).toBe('R$ 189,90')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('R$ 0,00')
  })

  it('formats large value', () => {
    expect(formatCurrency(1234.56)).toBe('R$ 1234,56')
  })
})

describe('navigation permissions', () => {
  it('routes permission exists for admin role', async () => {
    const { hasPermission } = await import('../constants/permissions')
    expect(hasPermission('admin', 'routes')).toBe(true)
  })

  it('routes permission is denied for passenger role', async () => {
    const { hasPermission } = await import('../constants/permissions')
    expect(hasPermission('passenger', 'routes')).toBe(false)
  })
})

describe('navigation items', () => {
  it('includes rotas nav item', async () => {
    const { NAV_ITEMS } = await import('../constants/navigation')
    const rotasItem = NAV_ITEMS.find((item) => item.path === '/rotas')
    expect(rotasItem).toBeDefined()
    expect(rotasItem?.label).toBe('Rotas e Valores')
    expect(rotasItem?.icon).toBe('MapPin')
  })

  it('rotas item is not in passenger nav', async () => {
    const { PASSENGER_NAV_ITEMS } = await import('../constants/navigation')
    const rotasItem = PASSENGER_NAV_ITEMS.find((item) => item.path === '/rotas')
    expect(rotasItem).toBeUndefined()
  })
})
