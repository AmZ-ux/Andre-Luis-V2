import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export function ServerErrorPage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-6">
      <div className="h-24 w-24 rounded-3xl bg-error/10 flex items-center justify-center mb-6">
        <AlertTriangle className="h-12 w-12 text-error" />
      </div>
      <h1 className="text-2xl font-bold text-text mb-2">Erro interno do servidor</h1>
      <p className="text-sm text-gray-500 mb-8 max-w-md">
        Ocorreu um erro inesperado. Nossa equipe foi notificada automaticamente. Tente novamente em alguns instantes.
      </p>
      <div className="flex gap-3">
        <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={() => window.location.reload()}>
          Tentar novamente
        </Button>
        <Button icon={<Home className="h-4 w-4" />} onClick={() => navigate('/')}>
          Voltar ao Início
        </Button>
      </div>
    </div>
  )
}
