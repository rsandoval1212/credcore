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
        try { sessionStorage.removeItem('credcore-auth') } catch {}
      },
    }),
    {
      name: 'credcore-auth',
      storage: {
        getItem: (name) => {
          const str = sessionStorage.getItem(name)
          if (!str) return null
          try {
            const parsed = JSON.parse(str)
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
        isAuthenticated: state.isAuthenticated,
        lastActivity: state.lastActivity,
        accessToken: null,
        refreshToken: null,
      } as unknown as AuthState),
    }
  )
)

if (typeof window !== 'undefined') {
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

  try { localStorage.removeItem('credcore-auth') } catch {}
}
