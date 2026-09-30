import type { Route } from '../types/route'

/** Unique active origins from routes, sorted alphabetically (pt-BR) */
export function getUniqueActiveOrigins(routes: Route[]): string[] {
  const set = new Set(routes.filter((r) => r.active).map((r) => r.origin))
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/** Active destinations for a given origin */
export function getActiveDestinations(routes: Route[], origin: string): string[] {
  if (!origin) return []
  return routes
    .filter((r) => r.active && r.origin === origin)
    .map((r) => r.destination)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/** Resolve route from origin + destination */
export function resolveRoute(routes: Route[], origin: string, destination: string): Route | null {
  if (!origin || !destination) return null
  return routes.find(
    (r) => r.origin === origin && r.destination === destination && r.active
  ) || null
}

/** Format BRL currency */
export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}
