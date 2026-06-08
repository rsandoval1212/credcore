/**
 * Sistema offline-first de CredCore:
 *
 *  • Cache de respuestas GET en localStorage (con TTL)
 *  • Cola FIFO de operaciones de escritura (POST/PATCH/PUT/DELETE)
 *  • Drenaje automático cuando vuelve la conexión
 *  • Eventos para que la UI muestre estado y contador de pendientes
 */

const CACHE_KEY = 'credcore_offline_cache_v1'
const QUEUE_KEY = 'credcore_offline_queue_v1'
const TTL_MS    = 24 * 60 * 60 * 1000  // 24h

// ──────────── Eventos del bus offline ──────────────────────────────────
type Listener = (count: number) => void
const listeners: Set<Listener> = new Set()
export const offlineBus = {
  subscribe(fn: Listener) {
    listeners.add(fn)
    fn(getQueue().length)
    return () => { listeners.delete(fn) }
  },
  emit() {
    const c = getQueue().length
    listeners.forEach(l => l(c))
  },
}

// ──────────── Cache GET ────────────────────────────────────────────────
interface CacheEntry { data: unknown; ts: number; status: number }
type CacheMap = Record<string, CacheEntry>

function readCacheMap(): CacheMap {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') } catch { return {} }
}
function writeCacheMap(m: CacheMap) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(m)) } catch {
    // Si se llena, limpiar entradas viejas y reintentar
    const fresh: CacheMap = {}
    const now = Date.now()
    Object.entries(m).forEach(([k, v]) => { if (now - v.ts < 6 * 3600 * 1000) fresh[k] = v })
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(fresh)) } catch {}
  }
}

export function cacheGet(url: string, params?: unknown): CacheEntry | null {
  const key = makeKey(url, params)
  const map = readCacheMap()
  const entry = map[key]
  if (!entry) return null
  if (Date.now() - entry.ts > TTL_MS) {
    delete map[key]; writeCacheMap(map); return null
  }
  return entry
}

export function cacheSet(url: string, params: unknown, data: unknown, status: number) {
  const map = readCacheMap()
  map[makeKey(url, params)] = { data, ts: Date.now(), status }
  writeCacheMap(map)
}

export function cacheClear() {
  localStorage.removeItem(CACHE_KEY)
}

function makeKey(url: string, params?: unknown) {
  const norm = url.replace(/^\/+|\/+$/g, '')
  const p = params && Object.keys(params).length
    ? '?' + new URLSearchParams(params as Record<string, string>).toString()
    : ''
  return norm + p
}

// ──────────── Cola de escrituras ───────────────────────────────────────
export interface QueuedOp {
  id: string
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  url: string
  data?: unknown
  createdAt: number
  description: string  // texto amigable para mostrar al usuario
  retries: number
}

export function getQueue(): QueuedOp[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') } catch { return [] }
}

function setQueue(q: QueuedOp[]) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)) } catch {}
}

export function enqueue(op: Omit<QueuedOp, 'id' | 'createdAt' | 'retries'>): QueuedOp {
  const queued: QueuedOp = {
    ...op,
    id: 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    createdAt: Date.now(),
    retries: 0,
  }
  const q = getQueue()
  q.push(queued)
  setQueue(q)
  offlineBus.emit()
  return queued
}

export function dequeue(id: string) {
  setQueue(getQueue().filter(o => o.id !== id))
  offlineBus.emit()
}

export function incrementRetry(id: string) {
  const q = getQueue().map(o => o.id === id ? { ...o, retries: o.retries + 1 } : o)
  setQueue(q)
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY)
  offlineBus.emit()
}

/**
 * Genera una descripción amigable de la operación basada en URL y método.
 */
export function describeOp(method: string, url: string, data?: Record<string, unknown>): string {
  const verbs: Record<string, string> = { POST: 'Crear', PATCH: 'Actualizar', PUT: 'Actualizar', DELETE: 'Eliminar' }
  const verb = verbs[method] || method
  if (url.includes('/customers') && !url.includes('/customers/'))     return `${verb} cliente`
  if (url.includes('/customers/'))                                    return `${verb} datos de cliente`
  if (url.includes('/loan-applications') && method === 'POST')        return 'Crear solicitud de préstamo'
  if (url.includes('/loan-applications') && url.includes('/submit'))  return 'Enviar solicitud para revisión'
  if (url.includes('/loan-applications') && url.includes('/approve')) return 'Aprobar solicitud'
  if (url.includes('/loan-applications') && url.includes('/reject'))  return 'Rechazar solicitud'
  if (url.includes('/loan-applications') && url.includes('/disburse'))return 'Desembolsar préstamo'
  if (url.includes('/payments') && method === 'POST')                 return `Registrar cobro RD$${(data?.total_amount as number) || ''}`
  if (url.includes('/cash/sessions') && method === 'POST')            return 'Abrir sesión de caja'
  if (url.includes('/cash/sessions') && url.includes('close'))        return 'Cerrar sesión de caja'
  if (url.includes('/activities'))                                    return 'Registrar actividad de cliente'
  if (url.includes('/credit_evaluation'))                             return 'Ejecutar evaluación crediticia'
  return `${verb}: ${url.split('/').slice(-2).join('/')}`
}
