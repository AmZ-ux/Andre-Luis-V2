import { useState, useEffect, useCallback } from 'react'
import type { Route } from '../types/route'
import { routeService } from '../services/routeService'

export function useRoutes() {
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = showInactive ? await routeService.listAll() : await routeService.list()
      setRoutes(data)
    } catch {
      setError('Não foi possível carregar as rotas.')
    } finally {
      setLoading(false)
    }
  }, [showInactive])

  useEffect(() => {
    void load()
  }, [load])

  const createRoute = useCallback(async (origin: string, destination: string, monthlyAmount: number) => {
    const created = await routeService.create({ origin, destination, monthlyAmount })
    setRoutes((prev) => [...prev, created])
    return created
  }, [])

  const updateRoute = useCallback(async (id: string, data: { origin?: string; destination?: string; monthlyAmount?: number }) => {
    const updated = await routeService.update(id, data)
    setRoutes((prev) => prev.map((r) => (r.id === id ? updated : r)))
    return updated
  }, [])

  const deactivateRoute = useCallback(async (id: string) => {
    await routeService.deactivate(id)
    setRoutes((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const toggleShowInactive = useCallback(() => {
    setShowInactive((prev) => !prev)
  }, [])

  return {
    routes,
    loading,
    error,
    showInactive,
    toggleShowInactive,
    createRoute,
    updateRoute,
    deactivateRoute,
    reload: load,
  }
}
