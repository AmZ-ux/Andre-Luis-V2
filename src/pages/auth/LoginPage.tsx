import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { LoginForm } from '../../components/auth/LoginForm'
import { PageSpinner } from '../../components/ui/Spinner'

export function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()
  const requestedPath = (location.state as { from?: { pathname: string } })?.from?.pathname
  const from = requestedPath || '/'
  const verifyEmail = (location.state as { verifyEmail?: string })?.verifyEmail

  if (isLoading) {
    return (
      <div className="min-h-screen bg-secondary dark:bg-gray-950 flex items-center justify-center">
        <PageSpinner />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to={from} replace />
  }

  return (
    <AuthLayout
      title="Acessar o sistema"
      subtitle="Entre com suas credenciais para continuar"
    >
      <LoginForm initialVerifyEmail={verifyEmail} />
    </AuthLayout>
  )
}
