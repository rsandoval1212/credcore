import { useEffect, useState } from 'react'
import { Cloud, CheckCircle, AlertTriangle, Upload, Loader2, Info } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'

interface DriveStatus {
  configured: boolean
  service_account_email: string | null
  drive_folder_id: string
}

export default function DriveBackupConfig() {
  const [status, setStatus] = useState<DriveStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [folderId, setFolderId] = useState('')
  const [saFile, setSaFile] = useState<File | null>(null)

  const load = async () => {
    try {
      const r = await api.get<DriveStatus>('/system/drive-config/')
      setStatus(r.data)
      setFolderId(r.data.drive_folder_id || '')
    } catch { setStatus(null) }
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    if (!saFile && !folderId) { toast.error('Sube el archivo o ingresa el ID'); return }
    setLoading(true)
    try {
      const fd = new FormData()
      if (saFile) fd.append('service_account', saFile)
      if (folderId) fd.append('drive_folder_id', folderId)
      await api.post('/system/drive-config/', fd)
      toast.success('Configuración de Drive guardada')
      setSaFile(null)
      await load()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      toast.error(err.response?.data?.detail || 'Error guardando configuración')
    } finally { setLoading(false) }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const r = await api.post<{ success: boolean; folder_name?: string; message?: string }>('/system/drive-test/', {})
      if (r.data.success) {
        toast.success(`Conexión OK. Carpeta: ${r.data.folder_name}`, { duration: 5000 })
      } else {
        toast.error(r.data.message || 'No se pudo conectar')
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err.response?.data?.message || 'Error probando conexión')
    } finally { setTesting(false) }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-blue-100">
        <div className="flex items-center gap-3">
          <Cloud className="h-5 w-5 text-blue-600" />
          <div className="flex-1">
            <h3 className="font-bold text-gray-900">Respaldo a Google Drive</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Sube los respaldos automáticamente a una carpeta de Google Drive del dueño del software.
            </p>
          </div>
          {status?.configured ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
              <CheckCircle className="h-3.5 w-3.5" /> Configurado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">
              <AlertTriangle className="h-3.5 w-3.5" /> Sin configurar
            </span>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {status?.configured && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 space-y-1">
            <div><strong>Cuenta de servicio:</strong> {status.service_account_email}</div>
            <div><strong>ID de carpeta:</strong> <span className="font-mono">{status.drive_folder_id}</span></div>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 flex gap-2">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Cómo obtener los archivos:</p>
            <ol className="list-decimal ml-4 space-y-0.5">
              <li>En Google Cloud Console crea una cuenta de servicio y descarga su JSON</li>
              <li>Comparte tu carpeta de Drive con el email <code>...iam.gserviceaccount.com</code> de la cuenta</li>
              <li>Copia el ID de la carpeta (lo que viene después de <code>/folders/</code> en la URL)</li>
              <li>Sube el JSON aquí e ingresa el ID</li>
            </ol>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Archivo de cuenta de servicio (JSON)</label>
          <input type="file" accept=".json" onChange={e => setSaFile(e.target.files?.[0] || null)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          {saFile && <p className="text-xs text-emerald-600 mt-1">✓ {saFile.name}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">ID de la carpeta de Drive</label>
          <input type="text" value={folderId} onChange={e => setFolderId(e.target.value)}
            placeholder="1A2B3c4D5e6F7g8H9i0J..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono" />
        </div>

        <div className="flex gap-3">
          <button onClick={handleSave} disabled={loading || (!saFile && !folderId)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {loading ? 'Guardando...' : 'Guardar configuración'}
          </button>
          <button onClick={handleTest} disabled={testing || !status?.configured}
            className="px-4 py-2.5 border border-blue-200 text-blue-700 rounded-xl text-sm font-medium hover:bg-blue-50 disabled:opacity-60">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Probar conexión'}
          </button>
        </div>
      </div>
    </div>
  )
}
