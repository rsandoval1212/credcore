import { useState, useEffect, useCallback } from 'react'
import {
  HardDrive, FolderOpen, Usb, Plus, Trash2, CheckCircle,
  AlertTriangle, RefreshCw, Save, Info,
} from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'

interface Destination {
  kind: 'usb' | 'folder'
  config: string
  label?: string
  ok: boolean
  message: string
}

interface UsbInfo {
  letter: string
  label: string
  has_label: boolean
}

interface DestinationsResponse {
  destinations: Destination[]
  available_usbs: UsbInfo[]
  config_file: string
}

// Helper: invocar la API nativa de pywebview si está disponible (modo escritorio)
async function pickFolder(): Promise<string> {
  // window.pywebview.api.browse_folder() — solo existe en el WebView del exe
  const w = window as unknown as { pywebview?: { api?: { browse_folder?: () => Promise<string> } } }
  if (!w.pywebview?.api?.browse_folder) {
    toast.error('"Examinar carpeta" solo funciona en la app de escritorio (no en navegador)')
    return ''
  }
  try {
    return (await w.pywebview.api.browse_folder()) || ''
  } catch {
    return ''
  }
}

export default function BackupDestinations() {
  const [data, setData] = useState<DestinationsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [items, setItems] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get<DestinationsResponse>('/system/backup-destinations/')
      setData(r.data)
      setItems(r.data.destinations.map(d => d.config))
      setDirty(false)
    } catch {
      toast.error('No se pudieron cargar los destinos de respaldo')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    try {
      const r = await api.put<DestinationsResponse>('/system/backup-destinations/', {
        destinations: items,
      })
      setData(r.data)
      setItems(r.data.destinations.map(d => d.config))
      setDirty(false)
      toast.success('Destinos guardados — el próximo respaldo los usará')
    } catch {
      toast.error('Error guardando destinos')
    } finally {
      setSaving(false)
    }
  }

  const addFolder = async () => {
    const path = await pickFolder()
    if (!path) return
    if (items.includes(path)) {
      toast('Esa carpeta ya está en la lista', { icon: 'ℹ️' })
      return
    }
    setItems(arr => [...arr, path])
    setDirty(true)
  }

  const addUsb = (label: string) => {
    const entry = `usb:${label}`
    if (items.includes(entry)) {
      toast('Esa USB ya está en la lista', { icon: 'ℹ️' })
      return
    }
    setItems(arr => [...arr, entry])
    setDirty(true)
  }

  const remove = (idx: number) => {
    setItems(arr => arr.filter((_, i) => i !== idx))
    setDirty(true)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center gap-3">
        <RefreshCw className="h-5 w-5 text-primary-500 animate-spin" />
        <span className="text-sm text-gray-600">Cargando configuración de respaldos...</span>
      </div>
    )
  }

  const usbsConLabel = data?.available_usbs.filter(u => u.has_label) || []
  const usbsSinLabel = data?.available_usbs.filter(u => !u.has_label) || []

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-primary-50 to-blue-50 border-b border-primary-100">
        <div className="flex items-center gap-3">
          <HardDrive className="h-5 w-5 text-primary-600" />
          <div className="flex-1">
            <h3 className="font-bold text-gray-900">Destinos Automáticos de Respaldo</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Cada respaldo se copia a TODAS las ubicaciones de la lista. Una falla no afecta a las demás.
            </p>
          </div>
        </div>
      </div>

      {/* Lista de destinos actuales */}
      <div className="p-5 space-y-2">
        {items.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
            <div className="text-center">
              <Info className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Sin destinos configurados</p>
              <p className="text-xs mt-1">Los respaldos solo se guardarán localmente</p>
            </div>
          </div>
        ) : (
          items.map((cfg, i) => {
            const dest = data?.destinations.find(d => d.config === cfg)
            const isUsb = cfg.toLowerCase().startsWith('usb:')
            const Icon = isUsb ? Usb : FolderOpen
            const statusOk = dest?.ok ?? null
            return (
              <div key={i}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  statusOk === true ? 'border-emerald-200 bg-emerald-50' :
                  statusOk === false ? 'border-amber-200 bg-amber-50' :
                  'border-gray-200 bg-gray-50'
                }`}>
                <Icon className={`h-5 w-5 shrink-0 ${
                  statusOk === true ? 'text-emerald-600' :
                  statusOk === false ? 'text-amber-600' : 'text-gray-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate">{cfg}</p>
                  {dest && (
                    <p className={`text-xs mt-0.5 flex items-center gap-1 ${
                      statusOk ? 'text-emerald-700' : 'text-amber-700'
                    }`}>
                      {statusOk ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                      {dest.message}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => remove(i)}
                  className="p-2 rounded-lg text-red-500 hover:bg-red-50"
                  title="Quitar este destino"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Acciones para agregar destinos */}
      <div className="px-5 pb-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={addFolder}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <FolderOpen className="h-4 w-4" />
            Agregar carpeta (Drive Desktop, OneDrive, red)
          </button>

          {usbsConLabel.length > 0 && (
            <div className="flex items-center gap-1">
              {usbsConLabel.map(u => (
                <button
                  key={u.letter}
                  onClick={() => addUsb(u.label)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50"
                  title={`Agregar USB "${u.label}" en ${u.letter}`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <Usb className="h-4 w-4" />
                  {u.label}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            title="Refrescar (volver a detectar USBs)"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refrescar
          </button>
        </div>

        {usbsSinLabel.length > 0 && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
            <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
            Hay {usbsSinLabel.length} USB sin etiqueta ({usbsSinLabel.map(u => u.letter).join(', ')}).
            En el Explorador, clic derecho → Cambiar nombre y ponle un nombre como "CREDCORE_USB".
          </p>
        )}

        {dirty && (
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <p className="text-xs text-amber-700">
              <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
              Hay cambios sin guardar
            </p>
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 font-medium"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
