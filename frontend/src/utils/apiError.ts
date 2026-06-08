/**
 * Extrae un mensaje legible de cualquier error de la API de CredCore.
 *
 * El backend usa custom_exception_handler que devuelve:
 *   { success: false, detail: "string o null", errors: { campo: ["msg"] }, status_code: 400 }
 *
 * También puede devolver HTML si Django crashea con 500 sin capturar.
 */
export function extractApiError(
  error: unknown,
  fallback = 'Ocurrió un error. Intenta de nuevo.'
): string {
  if (!error) return fallback

  const e = error as {
    response?: { data?: unknown; status?: number }
    message?: string
  }

  const data = e.response?.data
  const httpStatus = e.response?.status

  // Sin respuesta → error de red / servidor apagado
  if (data === undefined || data === null) {
    if (e.message?.toLowerCase().includes('network')) return 'Sin conexión con el servidor.'
    if (e.message) return e.message
    return fallback
  }

  // HTML crudo → Django crasheó con 500 sin capturar
  if (typeof data === 'string') {
    if (data.includes('<!DOCTYPE') || data.includes('<html')) {
      if (httpStatus === 500) return 'Error interno del servidor. Contacta al administrador.'
      if (httpStatus === 404) return 'Recurso no encontrado.'
      return `Error del servidor (${httpStatus ?? 'desconocido'}).`
    }
    return data
  }

  if (typeof data !== 'object') return fallback

  const d = data as Record<string, unknown>

  // Formato CredCore: { detail, errors, status_code }
  // 1. Usar `detail` si existe (string directo)
  if (typeof d.detail === 'string' && d.detail) return d.detail

  // 2. Aplanar `errors` (objeto con campos)
  if (d.errors) {
    const msg = flattenErrors(d.errors)
    if (msg) return msg
  }

  // 3. DRF estándar sin wrapper: { campo: ["msg"] }
  const msg = flattenErrors(d)
  if (msg) return msg

  return fallback
}

/** Aplana errores DRF a string legible */
function flattenErrors(errors: unknown): string {
  if (!errors) return ''
  if (typeof errors === 'string') return errors
  if (Array.isArray(errors)) return errors.map(String).filter(Boolean).join(', ')

  if (typeof errors === 'object') {
    const parts: string[] = []
    for (const [key, val] of Object.entries(errors as Record<string, unknown>)) {
      // Ignorar los campos del wrapper CredCore
      if (['success', 'status_code', 'detail'].includes(key)) continue

      const msg = Array.isArray(val)
        ? val.map(String).join(', ')
        : typeof val === 'string'
          ? val
          : JSON.stringify(val)

      if (!msg) continue

      if (key === 'non_field_errors' || key === '__all__') {
        parts.unshift(msg)
      } else {
        // Humanizar el nombre del campo
        const label = key.replace(/_/g, ' ')
        parts.push(`${label}: ${msg}`)
      }
    }
    return parts.join(' | ')
  }

  return ''
}
