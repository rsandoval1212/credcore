import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  toggle: () => void
  set: (t: Theme) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'light',
      toggle: () => set((s) => {
        const next = s.theme === 'light' ? 'dark' : 'light'
        applyTheme(next)
        return { theme: next }
      }),
      set: (t) => { applyTheme(t); set({ theme: t }) },
    }),
    { name: 'credcore-theme' }
  )
)

function applyTheme(t: Theme) {
  if (typeof document === 'undefined') return
  if (t === 'dark') document.documentElement.classList.add('dark')
  else document.documentElement.classList.remove('dark')
}

if (typeof window !== 'undefined') {
  setTimeout(() => applyTheme(useThemeStore.getState().theme), 0)
}
