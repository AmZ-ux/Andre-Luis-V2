import { Search } from 'lucide-react'
import { cn } from '../../utils/cn'

interface SearchBarProps {
  placeholder?: string
  className?: string
}

export function SearchBar({ placeholder = 'Pesquisar...', className }: SearchBarProps) {
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      <input
        type="text"
        placeholder={placeholder}
        className={cn(
          'w-full h-10 rounded-xl border border-gray-200 dark:border-gray-700',
          'bg-gray-50 dark:bg-gray-800 pl-10 pr-4',
          'text-sm text-text dark:text-gray-100 placeholder:text-gray-400',
          'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
          'transition-all duration-200'
        )}
      />
    </div>
  )
}
