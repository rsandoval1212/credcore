import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  lastActivity: number
  setAuth: (user: User, access: string, refresh: string) => void
  setTokens: (access: string, refresh: string) => void
  touchActivity: () => void
  logout: () => void
}

// FIX #6: Auto-logout por inactividad (30 min)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000

export const useAuthStore = create<AuthState>()(
  persist(
    (set, _get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      lastActivity: Date.now(),

      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true, lastActivity: Date.now() }),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken, lastActivity: Date.now() }),

      touchActivity: () => set({ lastActivity: Date.now() }),

      logout: () => {
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, lastActivity: 0 })
        // Limpiar sessionStorage también
        try { sessionStorage.removeItem('credcore-auth') } catch {}
      },
    }),
    {
      name: 'credcore-auth',
      storage: {
        // FIX #6: Usar sessionStorage en vez de localStorage (se limpia al cerrar pestaña)
        getItem: (name) => {
          const str = sessionStorage.getItem(name)
          if (!str) return null
          try {
            const parsed = JSON.parse(str)
            // Verificar timeout de inactividad
            const lastActivity = parsed?.state?.lastActivity || 0
            if (Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
              sessionStorage.removeItem(name)
              return null
            }
            return parsed
          } catch { return null }
        },
        setItem: (name, value) => sessionStorage.setItem(name, JSON.stringify(value)),
        removeItem: (name) => sessionStorage.removeItem(name),
      },
      partialize: (state: AuthState) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        lastActivity: state.lastActivity,
      } as unknown as AuthState),
    }
  )
)

// Auto-logout checker: cada 60s verifica inactividad
if (typeof window !== 'undefined') {
  // Registrar actividad del usuario
  const touch = () => useAuthStore.getState().touchActivity()
  window.addEventListener('click', touch, { passive: true })
  window.addEventListener('keydown', touch, { passive: true })
  window.addEventListener('scroll', touch, { passive: true })

  setInterval(() => {
    const { isAuthenticated, lastActivity, logout } = useAuthStore.getState()
    if (isAuthenticated && Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
      logout()
      window.location.href = '/login'
    }
  }, 60_000)

  // Limpiar localStorage viejo si existe (migración)
  try { localStorage.removeItem('credcore-auth') } catch {}
}
