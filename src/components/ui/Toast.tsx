import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToast } from '../../contexts/ToastContext'
import { cn } from '../../utils/cn'

const toastMap = {
  success: { icon: CheckCircle, chip: 'bg-success-soft text-success' },
  error: { icon: XCircle, chip: 'bg-error-soft text-error' },
  warning: { icon: AlertTriangle, chip: 'bg-warning-soft text-warning' },
  info: { icon: Info, chip: 'bg-primary-soft text-primary' },
}

export function ToastContainer() {
  const { toasts, removeToast } = useToast()

  return (
    <div className="fixed top-20 inset-x-4 sm:inset-x-auto sm:right-4 z-[100] flex flex-col items-stretch sm:items-end gap-2 sm:w-96 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const { icon: Icon, chip } = toastMap[toast.type]
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: 'spring', damping: 28, stiffness: 380 }}
              className={cn(
                'pointer-events-auto w-full bg-white dark:bg-gray-900 rounded-xl shadow-pop',
                'border border-gray-200 dark:border-gray-800 p-3 pl-4 flex items-start gap-3'
              )}
              role="status"
            >
              <span className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', chip)}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-sm font-semibold text-text leading-snug">{toast.title}</p>
                {toast.message && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{toast.message}</p>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="h-7 w-7 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center shrink-0 transition-colors"
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