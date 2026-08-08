import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../auth/AuthContext'
import { sessionManager } from '../../auth/sessionManager'
import { Clock, RefreshCw } from 'lucide-react'
import { Button } from '../ui/Button'

export function SessionTimeoutModal() {
  const { logout } = useAuth()
  const [show, setShow] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = sessionManager.getTimeRemaining()
      const shouldShow = remaining > 0 && remaining < 120000
      setShow(shouldShow)
      if (shouldShow) {
        setTimeLeft(Math.ceil(remaining / 1000))
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const handleRenew = () => {
    sessionManager.renew()
    setShow(false)
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-24 sm:bottom-4 right-4 z-[100] bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-4 w-full max-w-sm"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
              <Clock className="h-4 w-4 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text">Sessão expirando</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Sua sessão expira em{' '}
                <strong className="text-warning">{formatTime(timeLeft)}</strong>
              </p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={handleRenew} icon={<RefreshCw className="h-3.5 w-3.5" />}>
                  Continuar
                </Button>
                <Button size="sm" variant="ghost" onClick={logout}>
                  Sair
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
