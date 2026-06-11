/**
 * FIX #21: Hook para notificaciones en tiempo real via SSE (Server-Sent Events).
 * Se conecta a /api/v1/notifications/stream/ y recibe eventos del servidor.
 * Fallback a polling si SSE no esta disponible.
 */
import { useEffect, useCallback, useRef } from 'react'
import { create } from 'zustand'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/slices/authStore'

interface Notification {
  type: string
  data: {
    title: string
    message: string
    from?: string
    [key: string]: unknown
  }
  timestamp: string
}

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  addNotification: (n: Notification) => void
  clearAll: () => void
  markAllRead: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  addNotification: (n) =>
    set((s) => ({
      notifications: [n, ...s.notifications].slice(0, 50),
      unreadCount: s.unreadCount + 1,
    })),
  clearAll: () => set({ notifications: [], unreadCount: 0 }),
  markAllRead: () => set({ unreadCount: 0 }),
}))

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1'

export function useNotifications() {
  const { accessToken, isAuthenticated } = useAuthStore()
  const { addNotification } = useNotificationStore()
  const retryRef = useRef(0)
  const eventSourceRef = useRef<EventSource | null>(null)

  const connect = useCallback(() => {
    if (!isAuthenticated || !accessToken) return

    // Cerrar conexion previa
    eventSourceRef.current?.close()

    // Usar polling en vez de SSE (SSE no soporta headers de auth)
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/notifications/pending/`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (!res.ok) return
        const data = await res.json()
        if (data.notifications?.length > 0) {
          for (const n of data.notifications) {
            addNotification(n)
            // Mostrar toast
            if (n.data?.title) {
              toast(n.data.message || n.data.title, {
                icon: n.type === 'payment_received' ? '💰' : '🔔',
                duration: 5000,
              })
            }
          }
        }
        retryRef.current = 0
      } catch {
        retryRef.current++
      }
    }, 10000) // Poll cada 10 segundos

    return () => clearInterval(pollInterval)
  }, [isAuthenticated, accessToken, addNotification])

  useEffect(() => {
    const cleanup = connect()
    return () => {
      cleanup?.()
      eventSourceRef.current?.close()
    }
  }, [connect])

  return useNotificationStore()
}
