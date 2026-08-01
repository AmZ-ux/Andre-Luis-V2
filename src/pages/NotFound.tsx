import { useLocation, Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Home } from 'lucide-react'

export function NotFound() {
  const location = useLocation()

  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4 sm:py-24 sm:px-6">
      <div className="h-24 w-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-6">
        <span className="text-4xl font-bold text-primary">404</span>
      </div>
      <h1 className="text-2xl font-bold text-text mb-2">Página não encontrada</h1>
      <p className="text-sm text-gray-500 mb-8 max-w-md">
        A página <strong className="text-text">{location.pathname}</strong> não existe ou foi movida.
      </p>
      <Link to="/">
        <Button icon={<Home className="h-4 w-4" />}>
          Voltar ao Início
        </Button>
      </Link>
    </div>
  )
}
