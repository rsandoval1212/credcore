import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/store/slices/authStore'
import { cacheGet, cacheSet, enqueue, describeOp } from './offline'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
  withCredentials: true,  // Enviar httpOnly cookies automáticamente
})

// Marcador para evitar interceptar requests internas (ping de online check)
type Extended = InternalAxiosRequestConfig & { _retry?: boolean; _skipQueue?: boolean }

// ── REQUEST INTERCEPTOR ─────────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── RESPONSE INTERCEPTOR ────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => {
    // Cachear lecturas exitosas
    const cfg = response.config as Extended
    const method = (cfg.method || 'get').toUpperCase()
    if (method === 'GET' && response.status === 200) {
      try { cacheSet(cfg.url || '', cfg.params, response.data, response.status) } catch {}
    }
    return response
  },
  async (error: AxiosError) => {
    const original = error.config as Extended | undefined
    if (!original) return Promise.reject(error)

    const method = (original.method || 'get').toUpperCase()
    const isNetworkError = !error.response || error.code === 'ERR_NETWORK' ||
                            error.code === 'ECONNABORTED' || error.message === 'Network Error'

    // ── 1) Manejo de 401: intentar refresh, si falla → ir al login ─────────
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        // El refresh token se envía automáticamente via httpOnly cookie
        // También enviamos el que tenemos en memoria como fallback
        const refresh = useAuthStore.getState().refreshToken
        const { data } = await axios.post('/api/v1/auth/token/refresh/',
          refresh ? { refresh } : {},
          { withCredentials: true }
        )
        if (data.access) {
          useAuthStore.getState().setTokens(data.access, data.refresh || refresh || '')
          original.headers!.Authorization = `Bearer ${data.access}`
        }
        return api(original)
      } catch {
        // no-op: refresh falló, caemos al logout abajo
      }
      // Sin token válido → cerrar sesión y redirigir al login
      useAuthStore.getState().logout()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    // ── 2) Si es error de red (sin internet) ──────────────────────────────
    if (isNetworkError) {
      // GET → intentar servir del cache
      if (method === 'GET') {
        const cached = cacheGet(original.url || '', original.params)
        if (cached) {
          console.info('[offline] Sirviendo desde caché:', original.url)
          return Promise.resolve({
            data: cached.data,
            status: cached.status,
            statusText: 'OK (cached)',
            headers: {},
            config: original,
            request: null,
          })
        }
      }

      // POST/PATCH/PUT/DELETE → encolar para sincronizar después
      if (!original._skipQueue && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
        const op = enqueue({
          method: method as 'POST' | 'PATCH' | 'PUT' | 'DELETE',
          url: original.url || '',
          data: original.data ? safeParse(original.data) : undefined,
          description: describeOp(method, original.url || '', safeParse(original.data) as Record<string, unknown>),
        })
        // Devolvemos una respuesta "optimista" con flag offline
        return Promise.resolve({
          data: { _offline: true, _opId: op.id, _queued: true, message: 'Guardado localmente. Se sincronizará al recuperar conexión.' },
          status: 202,  // Accepted
          statusText: 'Accepted (offline)',
          headers: {},
          config: original,
          request: null,
        })
      }
    }

    return Promise.reject(error)
  }
)

function safeParse(v: unknown): unknown {
  if (typeof v === 'string') { try { return JSON.parse(v) } catch { return v } }
  return v
}

export default api
