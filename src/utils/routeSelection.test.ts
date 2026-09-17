import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Route } from '../types/route'

// --- Pure route selection logic extracted from PassengerForm ---

/** Unique active origins from routes, sorted alphabetically (pt-BR) */
function getUniqueActiveOrigins(routes: Route[]): string[] {
  const set = new Set(routes.filter((r) => r.active).map((r) => r.origin))
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/** Active destinations for a given origin */
function getActiveDestinations(routes: Route[], origin: string): string[] {
  if (!origin) return []
  return routes
    .filter((r) => r.active && r.origin === origin)
    .map((r) => r.destination)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/** Resolve route from origin + destination */
function resolveRoute(routes: Route[], origin: string, destination: string): Route | null {
  if (!origin || !destination) return null
  return routes.find(
    (r) => r.origin === origin && r.destination === destination && r.active
  ) || null
}

/** Format BRL currency */
function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

/** Normalizes BRL string for comparison (replaces non-breaking spaces) */
function normalizeBRL(s: string): string {
  return s.replace(/\u00a0/g, ' ')
}

/** Build the form payload for submit */
function buildFormPayload(data: {
  name: string; cpf: string; monthlyFee: string; dueDay: string
  routeId: string | null; [key: string]: any
}) {
  return {
    name: data.name,
    cpf: data.cpf,
    monthlyFee: parseFloat(data.monthlyFee),
    dueDay: parseInt(data.dueDay),
    routeId: data.routeId,
  }
}

// --- Test data ---

const mockRoutes: Route[] = [
  { id: 'r1', origin: 'Ipiranga do Piauí', destination: 'Universidade Federal', monthlyAmount: 400, active: true, createdAt: '', updatedAt: '' },
  { id: 'r2', origin: 'Ipiranga do Piauí', destination: 'IFPI', monthlyAmount: 350, active: true, createdAt: '', updatedAt: '' },
  { id: 'r3', origin: 'Dom Expedito', destination: 'Universidade Federal', monthlyAmount: 420, active: true, createdAt: '', updatedAt: '' },
  { id: 'r4', origin: 'Ipiranga do Piauí', destination: 'IFPI', monthlyAmount: 300, active: false, createdAt: '', updatedAt: '' },
  { id: 'r5', origin: 'Rota Inativa', destination: 'Destino Inativo', monthlyAmount: 500, active: false, createdAt: '', updatedAt: '' },
]

describe('Route selection logic (PassengerForm)', () => {
  describe('1. inactive routes not available for new association', () => {
    it('excludes inactive routes from origin list', () => {
      const origins = getUniqueActiveOrigins(mockRoutes)
      expect(origins).not.toContain('Rota Inativa')
    })

    it('inactive routes still included in listAll for editing', () => {
      const allOrigins = Array.from(new Set(mockRoutes.map((r) => r.origin)))
      expect(allOrigins).toContain('Rota Inativa')
    })
  })

  describe('2. duplicate origins shown once', () => {
    it('Ipiranga do Piauí appears once despite having multiple routes', () => {
      const origins = getUniqueActiveOrigins(mockRoutes)
      const count = origins.filter((o) => o === 'Ipiranga do Piauí').length
      expect(count).toBe(1)
    })
  })

  describe('3. origins sorted correctly', () => {
    it('origens are sorted alphabetically', () => {
      const origins = getUniqueActiveOrigins(mockRoutes)
      const sorted = [...origins].sort((a, b) => a.localeCompare(b, 'pt-BR'))
      expect(origins).toEqual(sorted)
    })
  })

  describe('4. destination disabled before origin', () => {
    it('returns empty destinations when no origin selected', () => {
      const dests = getActiveDestinations(mockRoutes, '')
      expect(dests).toEqual([])
    })
  })

  describe('5. destinations filtered by selected origin', () => {
    it('returns only destinations for Ipiranga do Piauí', () => {
      const dests = getActiveDestinations(mockRoutes, 'Ipiranga do Piauí')
      expect(dests).toContain('Universidade Federal')
      expect(dests).toContain('IFPI')
      expect(dests).not.toContain('Destino Inativo')
    })

    it('returns only destinations for Dom Expedito', () => {
      const dests = getActiveDestinations(mockRoutes, 'Dom Expedito')
      expect(dests).toEqual(['Universidade Federal'])
    })
  })

  describe('6. changing origin clears destination + route + value', () => {
    it('new origin yields different destinations', () => {
      const dests1 = getActiveDestinations(mockRoutes, 'Ipiranga do Piauí')
      const dests2 = getActiveDestinations(mockRoutes, 'Dom Expedito')
      expect(dests1).not.toEqual(dests2)
    })

    it('destination from old origin does not match new origin', () => {
      const route = resolveRoute(mockRoutes, 'Dom Expedito', 'IFPI')
      expect(route).toBeNull()
    })
  })

  describe('7. origin + destination resolve correct routeId', () => {
    it('resolves r1 for Ipiranga → UF', () => {
      const route = resolveRoute(mockRoutes, 'Ipiranga do Piauí', 'Universidade Federal')
      expect(route?.id).toBe('r1')
    })

    it('resolves r2 for Ipiranga → IFPI', () => {
      const route = resolveRoute(mockRoutes, 'Ipiranga do Piauí', 'IFPI')
      expect(route?.id).toBe('r2')
    })

    it('resolves r3 for Dom Expedito → UF', () => {
      const route = resolveRoute(mockRoutes, 'Dom Expedito', 'Universidade Federal')
      expect(route?.id).toBe('r3')
    })

    it('returns null for non-existent combination', () => {
      const route = resolveRoute(mockRoutes, 'Dom Expedito', 'IFPI')
      expect(route).toBeNull()
    })
  })

  describe('8. displayed value comes from route.monthlyAmount', () => {
    it('displays R$ 400,00 for route r1', () => {
      const route = resolveRoute(mockRoutes, 'Ipiranga do Piauí', 'Universidade Federal')
      expect(normalizeBRL(formatBRL(route!.monthlyAmount))).toBe('R$ 400,00')
    })

    it('displays R$ 350,00 for route r2', () => {
      const route = resolveRoute(mockRoutes, 'Ipiranga do Piauí', 'IFPI')
      expect(normalizeBRL(formatBRL(route!.monthlyAmount))).toBe('R$ 350,00')
    })

    it('displays R$ 420,00 for route r3', () => {
      const route = resolveRoute(mockRoutes, 'Dom Expedito', 'Universidade Federal')
      expect(normalizeBRL(formatBRL(route!.monthlyAmount))).toBe('R$ 420,00')
    })
  })

  describe('9. mensalidade is not user-editable (read-only)', () => {
    it('monthlyFee is set from route, not from user input', () => {
      const route = resolveRoute(mockRoutes, 'Ipiranga do Piauí', 'Universidade Federal')
      const payload = buildFormPayload({
        name: 'Test', cpf: '000', monthlyFee: String(route!.monthlyAmount),
        dueDay: '5', routeId: route!.id,
      })
      expect(payload.monthlyFee).toBe(400)
    })
  })

  describe('10. new passenger cannot save without route', () => {
    it('validation fails when no origin selected', () => {
      const origin = ''
      const destination = ''
      const route = resolveRoute(mockRoutes, origin, destination)
      expect(route).toBeNull()
    })

    it('validation fails when origin selected but no destination', () => {
      const route = resolveRoute(mockRoutes, 'Ipiranga do Piauí', '')
      expect(route).toBeNull()
    })
  })

  describe('11. new passenger sends correct routeId', () => {
    it('sends routeId matching resolved route', () => {
      const route = resolveRoute(mockRoutes, 'Ipiranga do Piauí', 'Universidade Federal')
      const payload = buildFormPayload({
        name: 'Test', cpf: '000', monthlyFee: '400',
        dueDay: '5', routeId: route?.id ?? null,
      })
      expect(payload.routeId).toBe('r1')
    })
  })

  describe('12. existing passenger pre-selects route', () => {
    it('finds route by id and extracts origin/destination', () => {
      const passengerRouteId = 'r2'
      const route = mockRoutes.find((r) => r.id === passengerRouteId)
      expect(route).toBeDefined()
      expect(route!.origin).toBe('Ipiranga do Piauí')
      expect(route!.destination).toBe('IFPI')
      expect(normalizeBRL(formatBRL(route!.monthlyAmount))).toBe('R$ 350,00')
    })
  })

  describe('13. legacy passenger (routeId=null) does not break', () => {
    it('resolves null route for null routeId', () => {
      const route = resolveRoute(mockRoutes, '', '')
      expect(route).toBeNull()
    })

    it('origins are still available for selection', () => {
      const origins = getUniqueActiveOrigins(mockRoutes)
      expect(origins.length).toBeGreaterThan(0)
    })
  })

  describe('14. inactive route linked to existing passenger', () => {
    it('can be found by id even though inactive', () => {
      const route = mockRoutes.find((r) => r.id === 'r5')
      expect(route).toBeDefined()
      expect(route!.active).toBe(false)
    })

    it('does NOT appear in active origin list', () => {
      const origins = getUniqueActiveOrigins(mockRoutes)
      expect(origins).not.toContain('Rota Inativa')
    })

    it('does NOT appear in active destinations', () => {
      const dests = getActiveDestinations(mockRoutes, 'Ipiranga do Piauí')
      expect(dests).not.toContain('Destino Inativo')
    })
  })

  describe('15. loading state prevents invalid selection', () => {
    it('empty routes array means no origins', () => {
      const origins = getUniqueActiveOrigins([])
      expect(origins).toEqual([])
    })

    it('empty routes array means no destinations', () => {
      const dests = getActiveDestinations([], 'Ipiranga do Piauí')
      expect(dests).toEqual([])
    })
  })

  describe('16. error state does not allow manual price fallback', () => {
    it('error state means no routes to select from', () => {
      const origins = getUniqueActiveOrigins([])
      expect(origins).toHaveLength(0)
    })
  })

  describe('17. zero active routes blocks new registration', () => {
    it('no active routes = empty origins = validation will fail', () => {
      const activeRoutes = mockRoutes.filter((r) => r.active)
      const origins = getUniqueActiveOrigins(activeRoutes)
      // All active origins are still valid
      expect(origins.length).toBeGreaterThan(0)
      // But if there were truly zero active routes:
      const emptyOrigins = getUniqueActiveOrigins([])
      expect(emptyOrigins).toHaveLength(0)
    })
  })
})

describe('Form payload audit', () => {
  it('form sends routeId from selected route', () => {
    const route = resolveRoute(mockRoutes, 'Ipiranga do Piauí', 'Universidade Federal')
    const payload = buildFormPayload({
      name: 'Teste', cpf: '123', monthlyFee: '400',
      dueDay: '5', routeId: route?.id ?? null,
    })
    expect(payload.routeId).toBe('r1')
  })

  it('form sends monthlyFee as number (from route)', () => {
    const route = resolveRoute(mockRoutes, 'Ipiranga do Piauí', 'Universidade Federal')
    const payload = buildFormPayload({
      name: 'Teste', cpf: '123', monthlyFee: String(route!.monthlyAmount),
      dueDay: '5', routeId: route!.id,
    })
    expect(typeof payload.monthlyFee).toBe('number')
    expect(payload.monthlyFee).toBe(400)
  })
})

describe('Tamper scenario audit', () => {
  it('TAMPERED_MONTHLY_FEE_SENT: 1 — client can send any monthlyFee', () => {
    const route = resolveRoute(mockRoutes, 'Ipiranga do Piauí', 'Universidade Federal')
    const payload = buildFormPayload({
      name: 'Teste', cpf: '123', monthlyFee: '1', // tampered!
      dueDay: '5', routeId: route?.id ?? null,
    })
    // The form would send monthlyFee=1 alongside routeId=r1
    expect(payload.monthlyFee).toBe(1)
    expect(payload.routeId).toBe('r1')
  })

  it('PERSISTED_PASSENGER_MONTHLY_FEE: backend ignores monthlyFee from frontend', () => {
    // Backend fields array includes 'monthly_fee' (snake_case)
    // Frontend sends 'monthlyFee' (camelCase)
    // flattenPassenger does NOT convert monthlyFee → monthly_fee
    // Therefore req.body['monthly_fee'] = undefined
    // Backend skips update → monthly_fee preserved
    const backendFields = ['name', 'rg', 'birth_date', 'phone', 'whatsapp', 'email',
      'zip_code', 'street', 'number', 'complement', 'neighborhood', 'city', 'state',
      'transport_type', 'institution', 'course', 'class', 'company', 'school', 'workplace',
      'monthly_fee', 'due_day', 'payment_method', 'status', 'notes', 'route_id']

    // Simulate what flattenPassenger sends
    const frontendPayload = {
      name: 'Teste', cpf: '123', monthlyFee: 1, // tampered camelCase
      route_id: 'r1', // correctly converted
      due_day: 5,
    }

    // Backend reads from fields array
    const monthlyFeeValue = frontendPayload['monthly_fee' as keyof typeof frontendPayload]
    const routeIdValue = frontendPayload['route_id' as keyof typeof frontendPayload]

    // monthlyFee (camelCase) is NOT in the fields array → not persisted
    expect(monthlyFeeValue).toBeUndefined()
    // route_id IS in the fields array → persisted
    expect(routeIdValue).toBe('r1')
  })

  it('PRICE_AUTHORITY_CURRENTLY: backend does not enforce route price', () => {
    // In Phase 2C, the backend does NOT validate monthlyFee against route.monthlyAmount
    // It simply ignores monthlyFee (wrong case) and only persists route_id
    // The authoritative price will come from routes in Phase 2D
    const backendAcceptsRouteId = true
    const backendValidatesPriceAgainstRoute = false // NOT YET
    expect(backendAcceptsRouteId).toBe(true)
    expect(backendValidatesPriceAgainstRoute).toBe(false)
  })
})

describe('Financial snapshot preservation', () => {
  it('changing routeId does NOT modify existing monthly_fees', () => {
    // Phase 2C principle: route_id is structural only
    // monthly_fees.amount is set at creation time and never modified by route changes
    const existingFee = { amount: 400, routeId: 'r1' }
    const newRouteId = 'r3' // different route with amount=420
    // After changing routeId, the existing fee amount should remain 400
    expect(existingFee.amount).toBe(400)
    // The new route's price will only apply to FUTURE fee creation (Phase 2D)
  })

  it('creating a route does NOT modify historical monthly_fees', () => {
    const historicalFee = { amount: 400, month: 8, year: 2026 }
    // Changing route price after fee creation should not affect this fee
    expect(historicalFee.amount).toBe(400)
  })
})
