// oxlint-disable react/only-export-components
import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute } from './guards/ProtectedRoute'
import { PageSpinner } from './components/ui/Spinner'

const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })))
const Passageiros = lazy(() => import('./pages/Passageiros').then((m) => ({ default: m.Passageiros })))
const PassageiroProfile = lazy(() => import('./pages/PassageiroProfile').then((m) => ({ default: m.PassageiroProfile })))
const Mensalidades = lazy(() => import('./pages/Mensalidades').then((m) => ({ default: m.Mensalidades })))
const MensalidadeProfile = lazy(() => import('./pages/MensalidadeProfile').then((m) => ({ default: m.MensalidadeProfile })))
const MinhaDisponibilidade = lazy(() => import('./pages/MinhaDisponibilidade').then((m) => ({ default: m.MinhaDisponibilidade })))
const MinhasMensalidades = lazy(() => import('./pages/MinhasMensalidades').then((m) => ({ default: m.MinhasMensalidades })))
const DisponibilidadeDetails = lazy(() => import('./pages/DisponibilidadeDetails').then((m) => ({ default: m.DisponibilidadeDetails })))
const CentralComunicacao = lazy(() => import('./pages/CentralComunicacao').then((m) => ({ default: m.CentralComunicacao })))
const Configuracoes = lazy(() => import('./pages/Configuracoes').then((m) => ({ default: m.Configuracoes })))
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })))
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })))
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })))
const ProfilePage = lazy(() => import('./pages/user/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const ChangePasswordPage = lazy(() => import('./pages/user/ChangePasswordPage').then((m) => ({ default: m.ChangePasswordPage })))
const SessionExpiredPage = lazy(() => import('./pages/errors/SessionExpiredPage').then((m) => ({ default: m.SessionExpiredPage })))
const ServerErrorPage = lazy(() => import('./pages/errors/ServerErrorPage').then((m) => ({ default: m.ServerErrorPage })))
const PrivacyPage = lazy(() => import('./pages/legal/PrivacyPage').then((m) => ({ default: m.PrivacyPage })))
const TermsPage = lazy(() => import('./pages/legal/TermsPage').then((m) => ({ default: m.TermsPage })))

function protect(element: React.ReactElement) {
  return <ProtectedRoute>{element}</ProtectedRoute>
}

function lazyPage(element: React.ReactElement) {
  return <Suspense fallback={<PageSpinner />}>{element}</Suspense>
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: lazyPage(<LoginPage />),
  },
  {
    path: '/cadastro',
    element: lazyPage(<RegisterPage />),
  },
  {
    path: '/esqueci-minha-senha',
    element: lazyPage(<ForgotPasswordPage />),
  },
  {
    path: '/redefinir-senha',
    element: lazyPage(<ResetPasswordPage />),
  },
  {
    path: '/sessao-expirada',
    element: lazyPage(<SessionExpiredPage />),
  },
  {
    path: '/politica-de-privacidade',
    element: lazyPage(<PrivacyPage />),
  },
  {
    path: '/termos-de-uso',
    element: lazyPage(<TermsPage />),
  },
  {
    path: '/',
    element: <AppLayout />,
    errorElement: lazyPage(<ServerErrorPage />),
    children: [
      { index: true, element: protect(lazyPage(<HomePage />)) },
      { path: 'passageiros', element: protect(lazyPage(<Passageiros />)) },
      { path: 'passageiros/:id', element: protect(lazyPage(<PassageiroProfile />)) },
      { path: 'mensalidades', element: protect(lazyPage(<Mensalidades />)) },
      { path: 'mensalidades/:id', element: protect(lazyPage(<MensalidadeProfile />)) },
      { path: 'disponibilidade', element: <Navigate to="/passageiros?tab=disponibilidade" replace /> },
      { path: 'disponibilidade/:id', element: protect(lazyPage(<DisponibilidadeDetails />)) },
      { path: 'minha-disponibilidade', element: protect(lazyPage(<MinhaDisponibilidade />)) },
      { path: 'minhas-mensalidades', element: protect(lazyPage(<MinhasMensalidades />)) },
      { path: 'comunicacao', element: protect(lazyPage(<CentralComunicacao />)) },
      { path: 'relatorios', element: <Navigate to="/?tab=relatorios" replace /> },
      { path: 'configuracoes', element: protect(lazyPage(<Configuracoes />)) },
      { path: 'perfil', element: protect(lazyPage(<ProfilePage />)) },
      { path: 'alterar-senha', element: protect(lazyPage(<ChangePasswordPage />)) },
      { path: '*', element: lazyPage(<NotFound />) },
    ],
  },
  { path: '/500', element: lazyPage(<ServerErrorPage />) },
  { path: '*', element: lazyPage(<NotFound />) },
])