/**
 * ExportButton — Botón de descarga de Excel/PDF.
 * Usa la instancia axios `api` para que el token se auto-refresque (interceptor)
 * y se envíen las cookies httpOnly. Esto evita fallos de descarga cuando el
 * access token de 15 min ha expirado.
 */
import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import api from '@/services/api'
import { saveBlob } from '@/utils/download'
import toast from 'react-hot-toast'

interface Props {
  /** Endpoint relativo, ej: '/api/v1/reports/export/customers/' */
  endpoint: string
  /** Nombre sugerido del archivo (sin extensión) */
  label?: string
  /** Parámetros de query opcionales */
  params?: Record<string, string>
  className?: string
  variant?: 'default' | 'ghost' | 'outline'
}

export default function ExportButton({
  endpoint,
  label = 'Exportar Excel',
  params,
  className = '',
  variant = 'default',
}: Props) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      // La instancia api ya tiene baseURL '/api/v1' — quitar ese prefijo si viene incluido
      const path = endpoint.replace(/^\/api\/v1/, '')

      const response = await api.get(path, {
        params,
        responseType: 'blob',
        timeout: 120_000,  // Reportes grandes pueden tardar
      })

      // Extraer nombre del archivo del header Content-Disposition
      const disposition = (response.headers['content-disposition'] as string) || ''
      const match = disposition.match(/filename="?([^"]+)"?/)
      const isPdf = path.includes('/pdf/')
      const filename = match?.[1] || (isPdf ? 'documento.pdf' : 'reporte.xlsx')

      const blob = response.data as Blob
      const saved = await saveBlob(blob, filename)
      if (saved) toast.success(`Archivo guardado: ${filename}`, { icon: '📊' })
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status
      if (status === 404) toast.error('No hay datos para generar el archivo')
      else toast.error('Error generando el archivo. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const base = 'flex items-center gap-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-60'
  const variants = {
    default: 'px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
    ghost:   'px-3 py-2 text-emerald-700 hover:bg-emerald-50',
    outline: 'px-3 py-2 border border-emerald-300 text-emerald-700 hover:bg-emerald-50 bg-white',
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className={`${base} ${variants[variant]} ${className}`}
      title="Exportar a Excel"
    >
      {loading
        ? <Loader2 className="h-4 w-4 animate-spin" />
        : <Download className="h-4 w-4" />}
      {loading ? 'Generando...' : label}
    </button>
  )
}
