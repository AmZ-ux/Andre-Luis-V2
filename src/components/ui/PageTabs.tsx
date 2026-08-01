import type { LucideIcon } from 'lucide-react'
import { cn } from '../../utils/cn'

export interface PageTab {
  key: string
  label: string
  icon?: LucideIcon
}

interface PageTabsProps {
  tabs: PageTab[]
  value: string
  onChange: (key: string) => void
}

export function PageTabs({ tabs, value, onChange }: PageTabsProps) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = value === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-200',
              isActive
                ? 'bg-primary text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
