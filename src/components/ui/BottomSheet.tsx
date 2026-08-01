import { type ReactNode } from 'react'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../../utils/cn'
import { useFocusTrap } from '../../hooks/useFocusTrap'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export function BottomSheet({ isOpen, onClose, title, children }: BottomSheetProps) {
  const containerRef = useFocusTrap(isOpen)

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={containerRef}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            className={cn(
              'relative w-full bg-white dark:bg-gray-900 rounded-t-2xl shadow-xl max-h-[85vh] overflow-y-auto'
            )}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>
            {title && (
              <div className="flex items-center justify-between px-5 py-3">
                <h2 className="text-lg font-semibold text-text">{title}</h2>
                <button
                  onClick={onClose}
                  className="h-11 w-11 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            )}
            <div className="p-5 pt-2">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
