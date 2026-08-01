import { useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../utils/cn'
import type { ButtonVariant, ButtonSize } from '../../types'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
  fullWidth?: boolean
  children?: ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-light active:bg-primary-dark shadow-sm',
  secondary:
    'bg-secondary dark:bg-gray-800 text-text border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200',
  outline:
    'border-2 border-primary text-primary bg-transparent hover:bg-primary/5 active:bg-primary/10',
  ghost:
    'text-text bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200',
  danger:
    'bg-error text-white hover:bg-red-500 active:bg-red-700 shadow-sm',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-11 px-4 text-sm gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-13 px-7 text-base gap-2.5',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  children,
  disabled,
  className,
  ...props
}: ButtonProps) {
  const btnRef = useRef<HTMLButtonElement>(null)

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = btnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const ripple = document.createElement('span')
    const size = Math.max(rect.width, rect.height)
    ripple.style.width = ripple.style.height = `${size}px`
    ripple.style.left = `${e.clientX - rect.left - size / 2}px`
    ripple.style.top = `${e.clientY - rect.top - size / 2}px`
    ripple.className = 'absolute rounded-full bg-white/30 animate-[ripple_0.6s_ease-out]'
    btn.appendChild(ripple)
    setTimeout(() => ripple.remove(), 600)
    props.onClick?.(e)
  }

  return (
    <button
      ref={btnRef}
      disabled={disabled || loading}
      className={cn(
        'relative inline-flex items-center justify-center font-medium rounded-xl',
        'transition-all duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed select-none overflow-hidden',
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
      onClick={handleClick}
    >
      {loading ? (
        <svg
          className="animate-spin h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children && <span>{children}</span>}
    </button>
  )
}
