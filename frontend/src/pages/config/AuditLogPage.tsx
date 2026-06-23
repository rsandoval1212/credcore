import { useState, useEffect } from 'react'
import { Activity, RefreshCw, Download, Trash2 } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { useDebounce } from '@/hooks/useDebounce'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'

export default function AuditLogPage() {
  const [entries, setEntries] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const debouncedFilter = useDebounce(filter, 300)

  const load = async () => {
    setLoading(true)
    try {
      const r = await api.get<{ entries: string[] }>('/system/audit-log/', { params: { limit: 300 } })
      setEntries(r.data.entries)
    } catch { setEntries([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = entries.filter(e =>
    !debouncedFilter || e.toLowerCase().includes(debouncedFilter.toLowerCase())
  )

  const colorFor = (entry: string): string => {
    if (entry.includes('LOGIN_FAILED') || entry.includes('ACCOUNT_LOCKED')) return 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20'
    if (entry.includes('LOGIN_OK')) return 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-900/20'
    if (entry.includes('AUDIT')) return 'border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20'
    return 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary-600" />
            Registro de Actividad
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Quién hizo qué en el sistema (logins, modificaciones, eliminaciones)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={() => {
            const blob = new Blob([entries.join('\n')], { type: 'text/plain' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a'); a.href = url; a.download = `audit_${new Date().toISOString().slice(0,10)}.log`
            a.click(); URL.revokeObjectURL(url)
          }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
            <Download className="h-3.5 w-3.5" /> Descargar
          </button>
          <button onClick={async () => {
            if (!window.confirm(`¿Eliminar TODAS las entradas del registro de actividad? Esta acción no se puede deshacer.\n\nSe descargará primero un respaldo automáticamente.`)) return
            const blob = new Blob([entries.join('\n')], { type: 'text/plain' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a'); a.href = url; a.download = `audit_backup_${new Date().toISOString().slice(0,10)}.log`
            a.click(); URL.revokeObjectURL(url)
            try {
              const r = await api.delete<{ cleared: number }>('/system/audit-log/')
              toast.success(`${r.data.cleared} entradas eliminadas`)
              setEntries([])
              setTimeout(load, 500)
            } catch (e: unknown) {
              const err = e as { response?: { data?: { detail?: string } } }
              toast.error(err.response?.data?.detail || 'Error al limpiar')
            }
          }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs border border-red-200 text-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
            <Trash2 className="h-3.5 w-3.5" /> Limpiar todo
          </button>
        </div>
      </div>

      <input value={filter} onChange={e => setFilter(e.target.value)}
        placeholder="Filtrar por email, IP, acción..."
        className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-sm" />

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <SkeletonTable rows={8} cols={1} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Activity className="h-8 w-8" />}
            title={entries.length === 0 ? 'Sin actividad registrada' : 'Sin resultados'}
            description={entries.length === 0
              ? 'La auditoría empezará a registrar cuando haya operaciones en el sistema.'
              : 'Prueba con otros términos de búsqueda.'}
          />
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-700 max-h-[70vh] overflow-y-auto">
            {filtered.map((e, i) => (
              <div key={i} className={`px-4 py-2.5 text-xs font-mono border-l-2 ${colorFor(e)}`}>
                <p className="text-gray-700 dark:text-gray-300 break-all">{e}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {entries.length > 0 && (
        <p className="text-xs text-gray-400 text-center">
          Mostrando {filtered.length} de {entries.length} entradas
        </p>
      )}
    </div>
  )
}
