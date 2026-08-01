import { RouterProvider } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './contexts/ToastContext'
import { AuthProvider } from './auth/AuthContext'
import { ToastContainer } from './components/ui/Toast'
import { SessionTimeoutModal } from './components/auth/SessionTimeoutModal'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { router } from './router'

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <RouterProvider router={router} />
            <ToastContainer />
            <SessionTimeoutModal />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
