import { motion } from 'framer-motion'
import { type ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface AnimatedCardProps {
  children: ReactNode
  className?: string
  index?: number
}

export function AnimatedCard({ children, className, index = 0 }: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  )
}
