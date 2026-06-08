import { useState, useEffect } from 'react'
import { WifiOff, Wifi, RefreshCw, CheckCircle, AlertCircle, X, Clock } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { offlineBus, getQueue, type QueuedOp } from '@/services/offline'
import { syncBus, drainQueue, type SyncStatus } from '@/services/syncManager'

export default function ConnectionStatusBar() {
  const isOnline = useOnlineStatus()
  const [pending, setPending] = useState(getQueue().length)
  const [sync, setSync] = useState<SyncStatus>({ syncing: false, pending: 0, succeeded: 0, failed: 0 })
  const [expanded, setExpanded] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [prevOnline, setPrevOnline] = useState(isOnline)

  useEffect(() => offlineBus.subscribe(setPending), [])
  useEffect(() => syncBus.subscribe(setSync), [])

  // Detectar restauración de conexión
  useEffect(() => {
    if (!prevOnline && isOnline && pending > 0) {
      window.dispatchEvent(new Event('credcore:connection-restored'))
    }
    if (!prevOnline && isOnline && pending === 0) {
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3500)
    }
    setPrevOnline(isOnline)
  }, [isOnline, prevOnline, pending])

  // Solo mostrar barra si: offline, syncing, o hay pendientes
  if (isOnline && pending === 0 && !sync.syncing && !showSuccess) return null

  // ── Banner conexión restaurada (verde, 3.5s)
  if (showSuccess && isOnline) {
    return (
      <div className="bg-emerald-600 text-white px-4 py-2 text-sm flex items-center justify-center gap-2 animate-in slide-in-from-top duration-200">
        <Wifi className="h-4 w-4" />
        <span className="font-medium">Conexión restaurada</span>
      </div>
    )
  }

  // ── Banner offline
  if (!isOnline) {
    return (
      <>
        <div className="bg-amber-500 text-white px-4 py-2 text-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <WifiOff className="h-4 w-4" />
            <span className="font-medium">Sin conexión a internet</span>
            <span className="text-amber-100">·</span>
            <span className="text-amber-50">Los datos se guardan localmente y se sincronizarán automáticamente.</span>
          </div>
          {pending > 0 && (
            <button onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 px-2 py-0.5 bg-amber-600 rounded text-xs hover:bg-amber-700">
              <Clock className="h-3 w-3" /> {pending} pendiente{pending !== 1 ? 's' : ''}
            </button>
          )}
        </div>
        {expanded && <PendingOpsList onClose={() => setExpanded(false)} />}
      </>
    )
  }

  // ── Banner sincronizando
  if (sync.syncing) {
    return (
      <div className="bg-blue-600 text-white px-4 py-2 text-sm flex items-center justify-center gap-2">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="font-medium">Sincronizando</span>
        {sync.currentOp && <span className="text-blue-100">· {sync.currentOp}</span>}
        <span className="text-blue-200">({sync.pending} restantes)</span>
      </div>
    )
  }

  // ── Banner: online pero hay cola (algo falló o aún no se procesó)
  if (pending > 0) {
    return (
      <>
        <div className="bg-blue-50 text-blue-700 border-b border-blue-200 px-4 py-2 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span className="font-medium">{pending} operacion{pending !== 1 ? 'es' : ''} pendiente{pending !== 1 ? 's' : ''} de sincronizar</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setExpanded(v => !v)} className="text-xs underline">
              {expanded ? 'Ocultar' : 'Ver detalles'}
            </button>
            <button onClick={() => drainQueue()} disabled={sync.syncing}
              className="flex items-center gap-1 px-3 py-0.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50">
              <RefreshCw className={`h-3 w-3 ${sync.syncing ? 'animate-spin' : ''}`} />
              Sincronizar ahora
            </button>
          </div>
        </div>
        {expanded && <PendingOpsList onClose={() => setExpanded(false)} />}
      </>
    )
  }

  return null
}

function PendingOpsList({ onClose }: { onClose: () => void }) {
  const [ops, setOps] = useState<QueuedOp[]>(getQueue())
  useEffect(() => offlineBus.subscribe(() => setOps(getQueue())), [])

  if (ops.length === 0) return null

  return (
    <div className="bg-white border-b border-gray-200 max-h-64 overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 sticky top-0 bg-white">
        <span className="text-xs font-semibold text-gray-600">Operaciones pendientes de sincronizar</span>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X className="h-3 w-3 text-gray-400" />
        </button>
      </div>
      <ul className="divide-y divide-gray-50">
        {ops.map(op => (
          <li key={op.id} className="px-4 py-2 flex items-center justify-between text-sm">
            <div>
              <p className="font-medium text-gray-700">{op.description}</p>
              <p className="text-xs text-gray-400">
                {new Date(op.createdAt).toLocaleString('es-DO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                {op.retries > 0 && <span className="text-amber-600 ml-2">· {op.retries} reintento{op.retries !== 1 ? 's' : ''}</span>}
              </p>
            </div>
            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
              <Clock className="inline h-3 w-3 mr-1" />Pendiente
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Helper para evitar warnings
export { CheckCircle }
