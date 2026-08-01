import { useCallback, useRef } from 'react'

export function useRateLimit(limit: number, windowMs: number) {
  const attempts = useRef<number[]>([])

  const check = useCallback((): boolean => {
    const now = Date.now()
    attempts.current = attempts.current.filter((t) => now - t < windowMs)

    if (attempts.current.length >= limit) return false

    attempts.current.push(now)
    return true
  }, [limit, windowMs])

  const remaining = useCallback((): number => {
    const now = Date.now()
    attempts.current = attempts.current.filter((t) => now - t < windowMs)
    return Math.max(0, limit - attempts.current.length)
  }, [limit, windowMs])

  const reset = useCallback(() => {
    attempts.current = []
  }, [])

  return { check, remaining, reset }
}
