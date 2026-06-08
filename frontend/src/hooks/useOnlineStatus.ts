import { useState, useEffect } from 'react'

/**
 * Detecta el estado de conexión combinando:
 * 1. navigator.onLine (señal del SO/navegador)
 * 2. Ping real al backend cada 15s usando el endpoint /api/v1/health/
 *    (público, sin autenticación — responde 200 {"status":"ok"})
 *
 * Lógica:
 * - Si navigator.onLine es false → offline inmediato (sin ping)
 * - Si el ping responde con status 200 → online
 * - Si el ping falla o da error de red → offline
 * - Timeout de 5s para el ping
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    let cancelled = false

    const verifyConnection = async () => {
      // Atajo rápido: si el navegador ya sabe que está offline, no pinguear
      if (!navigator.onLine) {
        if (!cancelled) setIsOnline(false)
        return
      }

      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 5000)

        const res = await fetch('/api/v1/health/', {
          method: 'GET',
          signal: controller.signal,
          headers: { 'Cache-Control': 'no-cache' },
        })
        clearTimeout(timer)

        if (!cancelled) setIsOnline(res.ok) // solo 200 cuenta como online
      } catch {
        // Error de red, timeout, o CORS → offline
        if (!cancelled) setIsOnline(false)
      }
    }

    const handleOnline  = () => verifyConnection()
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)

    // Ping inmediato al montar
    verifyConnection()

    // Ping periódico cada 15s
    const id = setInterval(verifyConnection, 15_000)

    return () => {
      cancelled = true
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(id)
    }
  }, [])

  return isOnline
}
