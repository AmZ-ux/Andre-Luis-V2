import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute } from './guards/ProtectedRoute'
import { HomePage } from './pages/HomePage'
import { Passageiros } from './pages/Passageiros'
import { PassageiroProfile } from './pages/PassageiroProfile'
import { Mensalidades } from './pages/Mensalidades'
import { MensalidadeProfile } from './pages/MensalidadeProfile'
import { MeusComprovantes } from './pages/MeusComprovantes'
import { ComprovanteDetails } from './pages/ComprovanteDetails'
import { MinhaDisponibilidade } from './pages/MinhaDisponibilidade'
import { DisponibilidadeDetails } from './pages/DisponibilidadeDetails'
import { CentralComunicacao } from './pages/CentralComunicacao'
import { Configuracoes } from './pages/Configuracoes'
import { NotFound } from './pages/NotFound'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage'
import { ProfilePage } from './pages/user/ProfilePage'
import { ChangePasswordPage } from './pages/user/ChangePasswordPage'
import { SessionExpiredPage } from './pages/errors/SessionExpiredPage'
import { ServerErrorPage } from './pages/errors/ServerErrorPage'

function protect(element: React.ReactElement) {
  return <ProtectedRoute>{element}</ProtectedRoute>
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/cadastro',
    element: <RegisterPage />,
  },
  {
    path: '/esqueci-minha-senha',
    element: <ForgotPasswordPage />,
  },
  {
    path: '/redefinir-senha',
    element: <ResetPasswordPage />,
  },
  {
    path: '/sessao-expirada',
    element: <SessionExpiredPage />,
  },
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <ServerErrorPage />,
    children: [
      { index: true, element: protect(<HomePage />) },
      { path: 'passageiros', element: protect(<Passageiros />) },
      { path: 'passageiros/:id', element: protect(<PassageiroProfile />) },
      { path: 'mensalidades', element: protect(<Mensalidades />) },
      { path: 'mensalidades/:id', element: protect(<MensalidadeProfile />) },
      { path: 'comprovantes', element: <Navigate to="/mensalidades?tab=comprovantes" replace /> },
      { path: 'comprovantes/:id', element: protect(<ComprovanteDetails />) },
      { path: 'meus-comprovantes', element: protect(<MeusComprovantes />) },
      { path: 'disponibilidade', element: <Navigate to="/passageiros?tab=disponibilidade" replace /> },
      { path: 'disponibilidade/:id', element: protect(<DisponibilidadeDetails />) },
      { path: 'minha-disponibilidade', element: protect(<MinhaDisponibilidade />) },
      { path: 'comunicacao', element: protect(<CentralComunicacao />) },
      { path: 'relatorios', element: <Navigate to="/?tab=relatorios" replace /> },
      { path: 'configuracoes', element: protect(<Configuracoes />) },
      { path: 'perfil', element: protect(<ProfilePage />) },
      { path: 'alterar-senha', element: protect(<ChangePasswordPage />) },
      { path: '*', element: <NotFound /> },
    ],
  },
  { path: '/500', element: <ServerErrorPage /> },
  { path: '*', element: <NotFound /> },
])
