import { type InputHTMLAttributes, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '../../utils/cn'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode
  error?: string
}

export function Checkbox({ label, error, className: _className, id, checked, onChange, disabled, ...props }: CheckboxProps) {
  const checkboxId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  // O texto fica FORA do <label>: elementos interativos (ex.: links dos termos)
  // dentro do label anulavam a ativação do checkbox ao clicar sobre eles.
  const handleTextClick = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (disabled) return
    if ((e.target as HTMLElement).closest('a, button')) return
    onChange?.({ target: { checked: !checked } } as React.ChangeEvent<HTMLInputElement>)
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-start gap-3">
        <label
          htmlFor={checkboxId}
          className={cn(
            'inline-flex cursor-pointer select-none items-center pt-0.5',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          <div className="relative flex items-center justify-center">
            <input
              type="checkbox"
              id={checkboxId}
              checked={checked}
              onChange={onChange}
              disabled={disabled}
              className="peer sr-only"
              {...props}
            />
            <div
              className={cn(
                'w-5 h-5 rounded-md border-2 transition-all duration-200',
                'flex items-center justify-center',
                'peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30',
                checked
                  ? 'bg-primary border-primary'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-primary',
                error && 'border-error'
              )}
            >
              {checked && (
                <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
              )}
            </div>
          </div>
        </label>
        {label && (
          <span
            onClick={handleTextClick}
            className={cn('text-sm text-text select-none', !disabled && 'cursor-pointer')}
          >
            {label}
          </span>
        )}
      </div>
      {error && (
        <p className="mt-1 text-sm text-error ml-8" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}