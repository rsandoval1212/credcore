import { useState, useEffect } from 'react'

/**
 * Detecta si el backend está accesible.
 *
 * En modo desktop (pywebview) o localhost, NO depende de navigator.onLine
 * ya que el backend corre localmente y no necesita internet.
 *
 * Solo se marca offline si el ping al health endpoint falla.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true) // Optimista: asumir online

  useEffect(() => {
    let cancelled = false

    // Detectar si estamos en modo local/desktop
    const isLocalMode =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      !!(window as any).pywebview

    const verifyConnection = async () => {
      // En modo local, NO usar navigator.onLine (puede ser false sin internet)
      // Solo verificar si el backend responde
      if (!isLocalMode && !navigator.onLine) {
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

        if (!cancelled) setIsOnline(res.ok)
      } catch {
        // En modo local, si el health falla probablemente el backend
        // aún está arrancando — no marcar offline inmediatamente
        if (!cancelled) {
          if (isLocalMode) {
            // Reintentar en 3s antes de marcar offline
            setTimeout(async () => {
              try {
                const r = await fetch('/api/v1/health/', { method: 'GET' })
                if (!cancelled) setIsOnline(r.ok)
              } catch {
                if (!cancelled) setIsOnline(false)
              }
            }, 3000)
          } else {
            setIsOnline(false)
          }
        }
      }
    }

    const handleOnline  = () => verifyConnection()
    const handleOffline = () => {
      // En modo local, ignorar el evento offline del navegador
      if (!isLocalMode) setIsOnline(false)
    }

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)

    // Ping inmediato
    verifyConnection()

    // Ping periódico cada 30s (más largo para no saturar en desktop)
    const id = setInterval(verifyConnection, isLocalMode ? 30_000 : 15_000)

    return () => {
      cancelled = true
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(id)
    }
  }, [])

  return isOnline
}
