import { Component, type ReactNode, type ErrorInfo } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { reportClientError } from '../../utils/errorReporter'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
    reportClientError(error, 'react-error-boundary')
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center text-center px-6 py-12" role="alert">
          <div className="h-16 w-16 rounded-2xl bg-error/10 flex items-center justify-center mb-5">
            <AlertTriangle className="h-8 w-8 text-error" />
          </div>
          <h2 className="text-lg font-semibold text-text mb-2">Algo deu errado</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-md">
            Ocorreu um erro inesperado. Tente recarregar a página ou entre em contato com o suporte.
          </p>
          <button
            onClick={this.handleRetry}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-light transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
