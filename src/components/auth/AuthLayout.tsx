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
              <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                <Bus className="h-5 w-5 text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-text leading-tight">Transportes</p>
                <p className="text-xs text-primary font-semibold">André Luis</p>
              </div>
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-text">{title}</h1>
            {subtitle && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
            )}
          </div>

          <div
            className={cn(
              'bg-white dark:bg-gray-900 rounded-xl shadow-card border border-gray-200 dark:border-gray-800',
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
        <div className="mt-2 flex items-center justify-center gap-4">
          <Link
            to="/termos-de-uso"
            className="text-xs text-gray-400 hover:text-primary transition-colors"
          >
            Termos de Uso
          </Link>
          <span className="text-xs text-gray-300 dark:text-gray-600">|</span>
          <Link
            to="/politica-de-privacidade"
            className="text-xs text-gray-400 hover:text-primary transition-colors"
          >
            Política de Privacidade
          </Link>
        </div>
      </footer>
    </div>
  )
}
