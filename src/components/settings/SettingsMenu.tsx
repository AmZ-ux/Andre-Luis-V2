import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
  Building2, DollarSign,
  Settings, Shield, HardDrive, Users,
} from 'lucide-react'
import { cn } from '../../utils/cn'
import type { SettingsCategory } from '../../types/settings'
import { SETTINGS_CATEGORIES } from '../../types/settings'

const iconMap: Record<string, LucideIcon> = {
  Building2, DollarSign, Settings, Shield, HardDrive, Users,
}

interface SettingsMenuProps {
  activeCategory: SettingsCategory | null
  onSelect: (category: SettingsCategory) => void
}

export function SettingsMenu({ activeCategory, onSelect }: SettingsMenuProps) {
  return (
    <nav className="space-y-1">
      {SETTINGS_CATEGORIES.map((cat) => {
        const Icon = iconMap[cat.icon] || Settings
        const isActive = activeCategory === cat.key
        return (
          <motion.button
            key={cat.key}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => onSelect(cat.key)}
            className={cn(
              'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-medium transition-colors duration-150 text-left',
              isActive
                ? 'bg-primary-soft text-primary'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-text'
            )}
          >
            <div className={cn(
              'h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-colors',
              isActive ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800'
            )}>
              <Icon className={cn('h-4 w-4', isActive ? 'text-white' : 'text-gray-400')} />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-sm font-medium truncate">{cat.label}</p>
              <p className="text-[10px] text-gray-400 truncate">{cat.description}</p>
            </div>
          </motion.button>
        )
      })}
    </nav>
  )
}
