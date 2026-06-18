import { useEffect, useState } from 'react'
import { Download, X, Sparkles } from 'lucide-react'
import api from '@/services/api'

interface UpdateInfo {
  has_update: boolean
  current_version?: string
  latest_version?: string
  download_url?: string
  notes?: string
  mandatory?: boolean
}

// Recordatorio: si el usuario cierra el banner, no lo molestamos hasta que
// salga una versión más nueva que esa. localStorage["update_dismissed"] guarda
// la última versión rechazada.
const DISMISS_KEY = 'update_dismissed_version'

export default function UpdateBanner() {
  const [info, setInfo] = useState<UpdateInfo | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Verificación silenciosa al cargar — si falla (sin internet) no molesta
    api.get<UpdateInfo>('/system/update-check/')
      .then(r => {
        if (!r.data.has_update) return
        const lastDismissed = localStorage.getItem(DISMISS_KEY)
        // Si el usuario ya rechazó esta versión específica, no la mostramos
        if (lastDismissed === r.data.latest_version && !r.data.mandatory) {
          return
        }
        setInfo(r.data)
      })
      .catch(() => { /* sin internet o sin URL configurada: ignorar */ })
  }, [])

  if (!info || dismissed) return null

  const onClose = () => {
    if (info.mandatory) return  // las obligatorias no se pueden cerrar
    if (info.latest_version) localStorage.setItem(DISMISS_KEY, info.latest_version)
    setDismissed(true)
  }

  const onDownload = () => {
    if (info.download_url) {
      window.open(info.download_url, '_blank', 'noopener,noreferrer')
    }
  }

  const bgClass = info.mandatory
    ? 'bg-red-50 border-red-200 text-red-900'
    : 'bg-blue-50 border-blue-200 text-blue-900'

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 border-b ${bgClass} text-sm`}>
      <Sparkles className="h-4 w-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="font-semibold">
          {info.mandatory ? 'Actualización requerida' : 'Hay una actualización disponible'}
        </span>
        <span className="opacity-80 ml-2">
          v{info.current_version} → <strong>v{info.latest_version}</strong>
        </span>
        {info.notes && (
          <span className="opacity-70 ml-2 hidden md:inline">· {info.notes}</span>
        )}
      </div>
      <button
        onClick={onDownload}
        className="flex items-center gap-1.5 px-3 py-1 bg-white border border-current rounded-md hover:bg-opacity-90 font-medium text-xs"
      >
        <Download className="h-3.5 w-3.5" />
        Descargar
      </button>
      {!info.mandatory && (
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/40 rounded"
          title="Recordarme con la próxima versión"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
