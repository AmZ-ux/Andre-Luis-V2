import { useEffect, useState } from 'react'
import { useNavigate, useRouteError } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { reportClientError } from '../../utils/errorReporter'

export function ServerErrorPage() {
  const navigate = useNavigate()
  const routeError = useRouteError()
  const [detail, setDetail] = useState<string>('')

  useEffect(() => {
    if (routeError) {
      reportClientError(routeError, 'route-error-element')
      setDetail(routeError instanceof Error ? `${routeError.message}\n${routeError.stack}` : String(routeError))
    }
  }, [routeError])

  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-6">
      <div className="h-24 w-24 rounded-3xl bg-error/10 flex items-center justify-center mb-6">
        <AlertTriangle className="h-12 w-12 text-error" />
      </div>
      <h1 className="text-2xl font-bold text-text mb-2">Erro interno do servidor</h1>
      <p className="text-sm text-gray-500 mb-8 max-w-md">
        Ocorreu um erro inesperado. Nossa equipe foi notificada automaticamente. Tente novamente em alguns instantes.
      </p>
      {detail && (
        <pre className="text-[10px] text-gray-400 text-left bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-6 max-w-md overflow-auto whitespace-pre-wrap">
          {detail}
        </pre>
      )}
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
