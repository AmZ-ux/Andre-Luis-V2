import { Search, X } from 'lucide-react'
import { cn } from '../../utils/cn'

interface MonthlySearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function MonthlySearch({
  value,
  onChange,
  placeholder = 'Buscar por nome, CPF, instituição...',
  className,
}: MonthlySearchProps) {
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full h-12 rounded-full border border-transparent',
          'bg-white dark:bg-gray-800 pl-11 pr-10 shadow-card',
          'text-sm text-text dark:text-gray-100 placeholder:text-gray-400',
          'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary',
          'transition-all duration-200'
        )}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center"
          aria-label="Limpar pesquisa"
        >
          <X className="h-3.5 w-3.5 text-gray-400" />
        </button>
      )}
    </div>
  )
}
