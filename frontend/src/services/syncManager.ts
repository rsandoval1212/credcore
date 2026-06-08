import axios from 'axios'
import { getQueue, dequeue, incrementRetry, offlineBus } from './offline'
import { useAuthStore } from '@/store/slices/authStore'

let syncing = false
const MAX_RETRIES = 5

type SyncListener = (status: SyncStatus) => void
export interface SyncStatus {
  syncing: boolean
  pending: number
  succeeded: number
  failed: number
  currentOp?: string
}

const syncListeners: Set<SyncListener> = new Set()
export const syncBus = {
  subscribe(fn: SyncListener) {
    syncListeners.add(fn)
    return () => { syncListeners.delete(fn) }
  },
  emit(s: SyncStatus) { syncListeners.forEach(l => l(s)) },
}

/**
 * Drena la cola de operaciones pendientes, una por una.
 * Si una falla por error de red, se detiene y espera la próxima conexión.
 * Si falla por error de servidor (400/500), incrementa retries; tras MAX_RETRIES se descarta.
 */
export async function drainQueue(): Promise<SyncStatus> {
  if (syncing) {
    return { syncing: true, pending: getQueue().length, succeeded: 0, failed: 0 }
  }

  const queue = getQueue()
  if (queue.length === 0) {
    const empty = { syncing: false, pending: 0, succeeded: 0, failed: 0 }
    syncBus.emit(empty)
    return empty
  }

  syncing = true
  let succeeded = 0
  let failed = 0

  syncBus.emit({ syncing: true, pending: queue.length, succeeded, failed })

  for (const op of queue) {
    syncBus.emit({ syncing: true, pending: getQueue().length, succeeded, failed, currentOp: op.description })
    try {
      const token = useAuthStore.getState().accessToken
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`

      await axios.request({
        method: op.method,
        url: '/api/v1' + (op.url.startsWith('/') ? op.url : '/' + op.url),
        data: op.data,
        headers,
        timeout: 15_000,
      })

      dequeue(op.id)
      succeeded++
    } catch (e: unknown) {
      const err = e as { response?: { status: number }; code?: string; message?: string }
      const isNet = !err.response || err.code === 'ERR_NETWORK' || err.message === 'Network Error'

      if (isNet) {
        // Volvimos a perder conexión → parar y esperar
        break
      }

      // Error de servidor: incrementar retries
      const updated = getQueue().find(o => o.id === op.id)
      const retries = (updated?.retries ?? 0) + 1
      if (retries >= MAX_RETRIES) {
        // Descartar operación tras max reintentos
        dequeue(op.id)
        failed++
        console.warn('[sync] Operación descartada tras', retries, 'reintentos:', op.description)
      } else {
        incrementRetry(op.id)
        failed++
        // Mover al final de la cola para no bloquear
      }
    }
  }

  syncing = false
  const finalStatus = { syncing: false, pending: getQueue().length, succeeded, failed }
  syncBus.emit(finalStatus)
  return finalStatus
}

let initialized = false
/**
 * Suscribe el drenador automático al evento online del navegador.
 * Debe llamarse una vez al iniciar la app.
 */
export function initAutoSync() {
  if (initialized) return
  initialized = true

  // Drena cuando vuelve la conexión
  window.addEventListener('online', () => {
    setTimeout(drainQueue, 1000)  // Pequeño delay para que el navegador estabilice
  })

  // Drena cuando el evento offline cambia (vía useOnlineStatus → emite custom event)
  window.addEventListener('credcore:connection-restored', () => {
    setTimeout(drainQueue, 500)
  })

  // Intento inicial si hay pendientes y estamos online
  if (navigator.onLine && getQueue().length > 0) {
    setTimeout(drainQueue, 2000)
  }

  // Cada cambio en la cola emite evento
  offlineBus.subscribe((count) => {
    if (count === 0) syncBus.emit({ syncing: false, pending: 0, succeeded: 0, failed: 0 })
  })

  // Reintento periódico cada minuto si hay pendientes
  setInterval(() => {
    if (navigator.onLine && getQueue().length > 0 && !syncing) {
      drainQueue()
    }
  }, 60_000)
}
