import { List, Grid3X3 } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { ViewMode } from '../../types/passenger'

interface ViewToggleProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 gap-0.5">
      <button
        onClick={() => onChange('list')}
        className={cn(
          'h-8 w-8 rounded-md flex items-center justify-center transition-all',
          value === 'list' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-gray-400 hover:text-text'
        )}
        aria-label="Visualizar como lista"
      >
        <List className="h-4 w-4" />
      </button>
      <button
        onClick={() => onChange('cards')}
        className={cn(
          'h-8 w-8 rounded-md flex items-center justify-center transition-all',
          value === 'cards' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-gray-400 hover:text-text'
        )}
        aria-label="Visualizar como cards"
      >
        <Grid3X3 className="h-4 w-4" />
      </button>
    </div>
  )
}
