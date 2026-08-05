import { motion, AnimatePresence } from 'framer-motion'

interface LoadingOverlayProps {
  visible: boolean
  message?: string
}

export function LoadingOverlay({ visible, message = 'Carregando...' }: LoadingOverlayProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 z-30 flex items-center justify-center bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm rounded-2xl"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" aria-hidden="true" />
            <p className="text-xs text-gray-500">{message}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
