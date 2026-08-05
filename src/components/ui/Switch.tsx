import { type InputHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
}

export function Switch({ label, className: _className, id, checked, onChange, disabled, ...props }: SwitchProps) {
  const switchId = id || label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <label
      htmlFor={switchId}
      className={cn(
        'inline-flex items-center gap-3 cursor-pointer select-none',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <div className="relative">
        <input
          type="checkbox"
          id={switchId}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="peer sr-only"
          {...props}
        />
        <div
          className={cn(
            'w-11 h-6 rounded-full transition-colors duration-300',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30',
            checked ? 'bg-primary' : 'bg-gray-300'
          )}
        >
          <div
            className={cn(
              'h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300',
              'absolute top-0.5 left-0.5',
              checked && 'translate-x-5'
            )}
          />
        </div>
      </div>
      {label && (
        <span className="text-sm text-text">{label}</span>
      )}
    </label>
  )
}
