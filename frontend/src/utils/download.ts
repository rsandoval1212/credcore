/**
 * Utilidad de descarga de archivos que funciona tanto en navegador como en
 * la app de escritorio (pywebview / WebView2).
 *
 * En WebView2 el patrón clásico (URL.createObjectURL + <a download>) NO
 * guarda el archivo. Cuando detectamos pywebview, enviamos el archivo en
 * base64 a Python (window.pywebview.api.save_file) que abre un diálogo
 * nativo "Guardar como".
 */

interface PyWebviewApi {
  save_file?: (filename: string, base64: string) => Promise<{ ok: boolean; cancelled?: boolean; path?: string; error?: string }>
  ping?: () => Promise<unknown>
}

function getDesktopApi(): PyWebviewApi | null {
  const pw = (window as unknown as { pywebview?: { api?: PyWebviewApi } }).pywebview
  if (pw?.api?.save_file) return pw.api
  return null
}

/** Indica si estamos corriendo dentro de la app de escritorio. */
export function isDesktopApp(): boolean {
  return getDesktopApi() !== null
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Guarda un Blob como archivo.
 * Devuelve true si se guardó, false si el usuario canceló o hubo error.
 */
export async function saveBlob(blob: Blob, filename: string): Promise<boolean> {
  const api = getDesktopApi()

  // ── Modo escritorio: diálogo nativo "Guardar como" ──────────────────────
  if (api?.save_file) {
    try {
      const base64 = await blobToBase64(blob)
      const res = await api.save_file(filename, base64)
      if (res?.cancelled) return false
      if (res?.ok === false) throw new Error(res?.error || 'Error guardando')
      return true
    } catch (e) {
      console.error('[download] save_file error:', e)
      throw e
    }
  }

  // ── Modo navegador: descarga estándar ───────────────────────────────────
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
