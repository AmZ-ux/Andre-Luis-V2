import { type ReactNode } from 'react'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../../utils/cn'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import type { Position } from '../../types'

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  position?: Position
}

export function Drawer({ isOpen, onClose, title, children, position = 'right' }: DrawerProps) {
  const containerRef = useFocusTrap(isOpen)

  const isLeft = position === 'left'

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50">
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
            initial={{ x: isLeft ? '-100%' : '100%' }}
            animate={{ x: 0 }}
            exit={{ x: isLeft ? '-100%' : '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              'absolute top-0 bottom-0 w-full max-w-md bg-white dark:bg-gray-900 shadow-xl',
              isLeft ? 'left-0' : 'right-0'
            )}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            {title && (
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-lg font-semibold text-text">{title}</h2>
                <button
                  onClick={onClose}
                  className="h-9 w-9 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            )}
            <div className="overflow-y-auto h-[calc(100%-65px)] p-5">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
