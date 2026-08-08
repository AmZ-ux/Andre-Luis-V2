import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToast } from '../../contexts/ToastContext'
import { cn } from '../../utils/cn'

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const colorMap = {
  success: 'border-l-success text-success',
  error: 'border-l-error text-error',
  warning: 'border-l-warning text-warning',
  info: 'border-l-primary text-primary',
}

const bgMap = {
  success: 'bg-success/5',
  error: 'bg-error/5',
  warning: 'bg-warning/5',
  info: 'bg-primary/5',
}

export function ToastContainer() {
  const { toasts, removeToast } = useToast()

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const Icon = iconMap[toast.type]
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={cn(
                'pointer-events-auto bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800',
                'border-l-4 p-4 flex items-start gap-3',
                bgMap[toast.type]
              )}
              role="alert"
            >
              <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', colorMap[toast.type])} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text">{toast.title}</p>
                {toast.message && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{toast.message}</p>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="h-6 w-6 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center shrink-0 transition-colors"
                aria-label="Fechar"
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
