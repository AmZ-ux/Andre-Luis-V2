import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bus } from 'lucide-react'
import { Container } from '../ui/Container'
import { cn } from '../../utils/cn'

interface AuthLayoutProps {
  children: ReactNode
  title: string
  subtitle?: string
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-secondary dark:bg-gray-950 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <Container maxWidth="sm">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
                <Bus className="h-5 w-5 text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-text leading-tight">Transporte</p>
                <p className="text-xs text-primary font-medium">André Luis</p>
              </div>
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-text">{title}</h1>
            {subtitle && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
            )}
          </div>

          <div
            className={cn(
              'bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800',
              'p-6 sm:p-8'
            )}
          >
            {children}
          </div>
        </Container>
      </div>

      <footer className="py-6 text-center">
        <p className="text-xs text-gray-400">
          &copy; {new Date().getFullYear()} Transporte André Luis. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  )
}
