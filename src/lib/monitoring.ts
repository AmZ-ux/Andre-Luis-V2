interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  uptime: number
  timestamp: string
  memory: {
    used: number
    total: number
    percentage: number
  }
  storage: {
    status: 'healthy' | 'unhealthy'
    items: number
  }
  version: string
  environment: string
}

let startTime = Date.now()

export const monitor = {
  getHealth(): HealthStatus {
    const memory = (performance as any)?.memory
    const usedMemory = memory?.usedJSHeapSize || 0
    const totalMemory = memory?.jsHeapSizeLimit || 0
    const storageItems = typeof window !== 'undefined' ? window.localStorage.length : 0

    return {
      status: 'healthy',
      uptime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentage: totalMemory > 0 ? Math.round((usedMemory / totalMemory) * 100) : 0,
      },
      storage: {
        status: 'healthy',
        items: storageItems,
      },
      version: import.meta.env.VITE_APP_VERSION || '1.0.0',
      environment: import.meta.env.VITE_APP_ENV || 'development',
    }
  },

  checkStorage(): boolean {
    try {
      localStorage.setItem('__health_check__', '1')
      localStorage.removeItem('__health_check__')
      return true
    } catch {
      return false
    }
  },

  getPerformanceMetrics(): { loadTime: number; memoryUsage: number; storageUsage: number } {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    const storageUsage = new Blob([JSON.stringify(localStorage)]).size

    return {
      loadTime: nav ? nav.loadEventEnd - nav.startTime : 0,
      memoryUsage: (performance as any)?.memory?.usedJSHeapSize || 0,
      storageUsage,
    }
  },

  resetStartTime(): void {
    startTime = Date.now()
  },
}
