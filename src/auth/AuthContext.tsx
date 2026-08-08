import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { AuthState, LoginCredentials, RegisterCredentials, User } from '../types/auth'
import { config } from '../config'
import { authService } from './authService'
import { sessionManager } from './sessionManager'
import { realAuth } from '../services/realApi'

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>
  register: (credentials: RegisterCredentials) => Promise<void>
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  updateProfile: (data: { name?: string; phone?: string; email?: string }) => Promise<User>
  sendVerificationEmail: () => Promise<{ demoCode?: string }>
  confirmVerificationEmail: (code: string) => Promise<User>
  endContract: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function createInitialState(): AuthState {
  if (typeof window === 'undefined') {
    return { user: null, isAuthenticated: false, isLoading: true, error: null }
  }

  if (sessionManager.isValid()) {
    const session = sessionManager.load()
    if (session) {
      return {
        user: session.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      }
    }
  }

  sessionManager.destroy()
  return { user: null, isAuthenticated: false, isLoading: false, error: null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(createInitialState)

  const refreshProfile = useCallback(async () => {
    if (!state.user) return
    try {
      if (config.realApi) {
        const user = await realAuth.me()
        setState((prev) => ({ ...prev, user }))
        const session = sessionManager.load()
        if (session) sessionManager.save({ ...session, user }, true)
      } else {
        const profile = await authService.getProfile(state.user.id)
        setState((prev) => ({ ...prev, user: profile }))
        const session = sessionManager.load()
        if (session) sessionManager.save({ ...session, user: profile }, true)
      }
    } catch {
      // silently ignore
    }
  }, [state.user])

  const login = useCallback(async (credentials: LoginCredentials) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await authService.login(credentials)
      sessionManager.save(
        { user: response.user, token: response.token, expiresAt: response.expiresAt },
        credentials.rememberMe
      )
      setState({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao autenticar'
      setState((prev) => ({ ...prev, isLoading: false, error: message }))
      throw err
    }
  }, [])

  const register = useCallback(async (credentials: RegisterCredentials) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await authService.register(credentials)
      sessionManager.save(
        { user: response.user, token: response.token, expiresAt: response.expiresAt },
        false
      )
      setState({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar conta'
      setState((prev) => ({ ...prev, isLoading: false, error: message }))
      throw err
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      if (config.realApi) await realAuth.logout()
    } catch {}
    sessionManager.destroy()
    setState({ user: null, isAuthenticated: false, isLoading: false, error: null })
  }, [])

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!state.user) throw new Error('Usuário não autenticado')
      await authService.changePassword(state.user.id, currentPassword, newPassword)
    },
    [state.user]
  )

  const updateProfile = useCallback(
    async (data: { name?: string; phone?: string; email?: string }) => {
      if (!state.user) throw new Error('Usuário não autenticado')
      const updated = await authService.updateProfile(state.user.id, data)
      setState((prev) => ({ ...prev, user: updated }))
      const session = sessionManager.load()
      if (session) sessionManager.save({ ...session, user: updated }, true)
      return updated
    },
    [state.user]
  )

  const sendVerificationEmail = useCallback(async () => {
    if (!state.user) throw new Error('Usuário não autenticado')
    return authService.sendVerificationEmail(state.user.id)
  }, [state.user])

  const confirmVerificationEmail = useCallback(
    async (code: string) => {
      if (!state.user) throw new Error('Usuário não autenticado')
      const updated = await authService.confirmVerificationEmail(state.user.id, code)
      setState((prev) => ({ ...prev, user: updated }))
      const session = sessionManager.load()
      if (session) sessionManager.save({ ...session, user: updated }, true)
      return updated
    },
    [state.user]
  )

  const endContract = useCallback(async () => {
    if (!state.user) throw new Error('Usuário não autenticado')
    await authService.endContract(state.user.id)
    await refreshProfile()
  }, [state.user, refreshProfile])

  useEffect(() => {
    const interval = setInterval(async () => {
      if (state.isAuthenticated) {
        if (!sessionManager.isValid()) {
          logout()
          return
        }
        if (sessionManager.shouldRenew()) {
          await sessionManager.renew()
        }
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [state.isAuthenticated, logout])

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        refreshProfile,
        changePassword,
        updateProfile,
        sendVerificationEmail,
        confirmVerificationEmail,
        endContract,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
