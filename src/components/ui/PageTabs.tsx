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
  className?: string
}

export function PageTabs({ tabs, value, onChange, className }: PageTabsProps) {
  return (
    <div
      className={cn(
        'inline-flex self-start bg-gray-100 dark:bg-gray-800 rounded-full p-1 gap-1 max-w-full overflow-x-auto scrollbar-hide',
        className
      )}
      role="tablist"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = value === tab.key
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={cn(
              'flex items-center justify-center gap-1.5 px-5 sm:px-6 h-10 text-sm font-semibold whitespace-nowrap rounded-full transition-all duration-150 min-w-fit flex-1 sm:flex-none',
              isActive
                ? 'bg-white dark:bg-gray-700 text-text shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-text'
            )}
          >
            {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}