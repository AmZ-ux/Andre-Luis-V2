export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return
  if (!import.meta.env.PROD) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // silencioso: PWA é progressivo, app segue funcionando sem SW
    })
  })
}
