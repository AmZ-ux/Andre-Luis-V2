import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { logger } from './lib/logger'
import { config } from './config'
import { registerServiceWorker } from './lib/registerSW'
import './styles/globals.css'

registerServiceWorker()

// Global error handlers
window.onerror = (message, source, lineno, colno, error) => {
  logger.critical('Uncaught exception', {
    message: String(message),
    source,
    line: lineno,
    column: colno,
    stack: error?.stack,
  })
}

window.onunhandledrejection = (event) => {
  logger.error('Unhandled promise rejection', {
    reason: event.reason instanceof Error ? event.reason.message : String(event.reason),
    stack: event.reason instanceof Error ? event.reason.stack : undefined,
  })
}

// Performance measurement
if (config.isProduction) {
  window.addEventListener('load', () => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    if (nav) {
      logger.info('App loaded', {
        loadTime: `${Math.round(nav.loadEventEnd - nav.startTime)}ms`,
        domContentLoaded: `${Math.round(nav.domContentLoadedEventEnd - nav.startTime)}ms`,
      })
    }
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
