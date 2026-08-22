import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bus, ArrowLeft } from 'lucide-react'
import { Container } from '../ui/Container'
import { cn } from '../../utils/cn'

interface LegalLayoutProps {
  children: ReactNode
  title: string
  updatedAt: string
}

export function LegalLayout({ children, title, updatedAt }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-secondary dark:bg-gray-950 flex flex-col">
      <header className="border-b border-gray-100 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 backdrop-blur sticky top-0 z-30">
        <Container maxWidth="md">
          <div className="flex items-center justify-between py-3">
            <Link to="/login" className="inline-flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
                <Bus className="h-4.5 w-4.5 text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-text leading-tight">Transporte</p>
                <p className="text-xs text-primary font-medium">André Luis</p>
              </div>
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Link>
          </div>
        </Container>
      </header>

      <main className="flex-1 py-10">
        <Container maxWidth="md">
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-text">{title}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Última atualização: {updatedAt}</p>
          </div>

          <div
            className={cn(
              'bg-white dark:bg-gray-900 rounded-xl shadow-card border border-gray-200 dark:border-gray-800',
              'p-6 sm:p-10 space-y-8 text-sm sm:text-base leading-relaxed text-gray-700 dark:text-gray-300'
            )}
          >
            {children}
          </div>
        </Container>
      </main>

      <footer className="py-6 text-center border-t border-gray-100 dark:border-gray-800">
        <p className="text-xs text-gray-400">
          &copy; {new Date().getFullYear()} Transporte André Luis. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  )
}
