import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Clock, LogIn } from 'lucide-react'

export function SessionExpiredPage() {
  return (
    <div className="min-h-screen bg-secondary dark:bg-gray-950 flex flex-col items-center justify-center text-center px-6 py-12">
      <div className="h-20 w-20 rounded-3xl bg-warning/10 flex items-center justify-center mb-6">
        <Clock className="h-10 w-10 text-warning" />
      </div>
      <h1 className="text-2xl font-bold text-text mb-2">Sessão expirada</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-md">
        Sua sessão foi encerrada por inatividade. Faça login novamente para continuar.
      </p>
      <Link to="/login">
        <Button icon={<LogIn className="h-4 w-4" />}>
          Fazer login novamente
        </Button>
      </Link>
    </div>
  )
}
