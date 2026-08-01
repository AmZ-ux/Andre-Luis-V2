import { config } from '../config'

// Reporta erros de runtime do frontend para o backend (POST /api/client-error),
// que os grava nos logs do servidor. Nunca deve lancar/atrapalhar o app.
export function reportClientError(error: unknown, context?: string) {
  try {
    const err = error instanceof Error ? error : new Error(String(error))
    const payload = {
      context: context || undefined,
      message: err.message ? err.message.slice(0, 500) : undefined,
      stack: err.stack ? err.stack.slice(0, 4000) : undefined,
      url: typeof window !== 'undefined' ? window.location.href.slice(0, 500) : undefined,
    }
    fetch(`${config.apiUrl || 'http://localhost:3001/api'}/client-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // silencioso por design
  }
}
