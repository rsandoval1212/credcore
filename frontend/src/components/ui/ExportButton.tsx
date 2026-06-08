/**
 * ExportButton — Botón de descarga de Excel con autenticación Bearer.
 * Usa fetch con el token JWT para descargar el archivo directamente.
 */
import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/slices/authStore'
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
  const { accessToken } = useAuthStore()

  const handleExport = async () => {
    setLoading(true)
    try {
      let url = endpoint
      if (params && Object.keys(params).length > 0) {
        const qs = new URLSearchParams(params).toString()
        url = `${endpoint}?${qs}`
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!response.ok) throw new Error(`Error ${response.status}`)

      // Extraer nombre del archivo del header Content-Disposition
      const disposition = response.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="?([^"]+)"?/)
      const filename = match?.[1] || 'reporte.xlsx'

      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)

      toast.success(`Descargando ${filename}`, { icon: '📊' })
    } catch {
      toast.error('Error generando el archivo Excel')
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
