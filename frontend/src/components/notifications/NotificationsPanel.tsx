import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, AlertTriangle, Clock, MessageCircle,
  CreditCard, RefreshCw, CheckCircle, BellOff, EyeOff, Trash2,
} from 'lucide-react'
import DropdownMenu from '@/components/ui/DropdownMenu'
import { notificationsService, type Alert } from '@/services/notifications'
import toast from 'react-hot-toast'

interface Props {
  onClose: () => void
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n)

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })

export default function NotificationsPanel({ onClose }: Props) {
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'overdue' | 'upcoming'>('all')
  const [sendingWa, setSendingWa] = useState<string | null>(null)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('credcore-dismissed-alerts')
      return new Set(stored ? JSON.parse(stored) : [])
    } catch { return new Set() }
  })

  const saveDismissed = (ids: Set<string>) => {
    setDismissedIds(ids)
    localStorage.setItem('credcore-dismissed-alerts', JSON.stringify([...ids]))
  }

  const dismissOne = (id: string) => {
    const next = new Set(dismissedIds); next.add(id); saveDismissed(next)
  }

  const dismissAll = () => {
    if (!window.confirm('¿Marcar todas las alertas como vistas?')) return
    const next = new Set(dismissedIds)
    alerts.forEach(a => next.add(a.id))
    saveDismissed(next)
    toast.success('Todas las alertas fueron ocultadas')
  }

  const muteToday = () => {
    const tomorrow = new Date(); tomorrow.setHours(24, 0, 0, 0)
    localStorage.setItem('credcore-mute-until', String(tomorrow.getTime()))
    toast.success('Alertas silenciadas hasta mañana', { duration: 4000 })
    onClose()
  }

  const restoreAll = () => {
    saveDismissed(new Set())
    toast.success('Alertas restauradas')
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await notificationsService.getAlertsDetail(tab, 7)
      setAlerts(r.data.results)
    } catch {
      toast.error('Error cargando alertas')
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { load() }, [load])

  const handleSendWhatsApp = async (alert: Alert) => {
    if (!alert.wa_url_reminder) {
      toast.error('El cliente no tiene número de WhatsApp registrado')
      return
    }
    setSendingWa(alert.id)
    try {
      notificationsService.openWhatsApp(alert.wa_url_reminder)
      toast.success(`WhatsApp abierto para ${alert.customer_name}`)
    } finally {
      setSendingWa(null)
    }
  }

  const handleSendAllOverdue = () => {
    const overdueWithWa = alerts.filter(a => a.type === 'overdue' && a.wa_url_reminder)
    if (overdueWithWa.length === 0) {
      toast.error('No hay clientes atrasados con WhatsApp registrado')
      return
    }
    // Abrir el primero (browsers bloquean múltiples popups)
    notificationsService.openWhatsApp(overdueWithWa[0].wa_url_reminder!)
    if (overdueWithWa.length > 1) {
      toast(`Abriendo WhatsApp de ${overdueWithWa[0].customer_name}. Repite para los demás.`, { icon: '📱' })
    } else {
      toast.success('WhatsApp abierto')
    }
  }

  const visibleAlerts = alerts.filter(a => !dismissedIds.has(a.id))
  const overdueCount = visibleAlerts.filter(a => a.type === 'overdue').length
  const upcomingCount = visibleAlerts.filter(a => a.type === 'upcoming').length

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right-4 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900">Alertas de Cobro</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {overdueCount > 0 && <span className="text-red-600 font-semibold">{overdueCount} atrasados</span>}
              {overdueCount > 0 && upcomingCount > 0 && ' · '}
              {upcomingCount > 0 && <span className="text-amber-600 font-semibold">{upcomingCount} próximos (7 días)</span>}
              {overdueCount === 0 && upcomingCount === 0 && 'Sin alertas pendientes'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <DropdownMenu
              align="right"
              trigger={<><span className="text-xs">Acciones</span><svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg></>}
              buttonClassName="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"
              items={[
                { label: 'Marcar todas como vistas', icon: <EyeOff className="h-4 w-4" />, onClick: dismissAll },
                { label: 'Silenciar hasta mañana', icon: <BellOff className="h-4 w-4" />, onClick: muteToday },
                { label: 'Restaurar todas', icon: <RefreshCw className="h-4 w-4" />, onClick: restoreAll, divider: true },
                { label: 'Limpiar caché de alertas', icon: <Trash2 className="h-4 w-4" />, onClick: () => { localStorage.removeItem('credcore-dismissed-alerts'); localStorage.removeItem('credcore-mute-until'); setDismissedIds(new Set()); toast.success('Caché limpiado') }, variant: 'danger' },
              ]}
            />
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-2">
          {[
            { id: 'all', label: `Todos (${alerts.length})` },
            { id: 'overdue', label: `Atrasados (${overdueCount})` },
            { id: 'upcoming', label: `Próximos (${upcomingCount})` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
              className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${tab === t.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Acciones masivas */}
        {overdueCount > 0 && (
          <div className="px-5 py-3 bg-red-50 border-b border-red-100 flex items-center justify-between">
            <p className="text-xs text-red-700 font-medium">
              {overdueCount} cliente{overdueCount !== 1 ? 's' : ''} con pagos vencidos
            </p>
            <button onClick={handleSendAllOverdue}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp a atrasados
            </button>
          </div>
        )}

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="h-5 w-5 text-primary-500 animate-spin" />
            </div>
          ) : visibleAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 px-6 text-center">
              <CheckCircle className="h-12 w-12 mb-3 opacity-30" />
              <p className="font-medium">{alerts.length === 0 ? '¡Todo al día!' : 'Sin alertas pendientes'}</p>
              <p className="text-sm mt-1">{alerts.length === 0 ? 'No hay pagos vencidos ni próximos a vencer' : `${alerts.length} alerta(s) marcada(s) como vista(s)`}</p>
              {alerts.length > 0 && (
                <button onClick={restoreAll} className="mt-3 text-xs text-primary-600 hover:underline">Restaurar alertas ocultas</button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {visibleAlerts.map(alert => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onWhatsApp={() => handleSendWhatsApp(alert)}
                  onViewLoan={() => { navigate(`/loans/${alert.loan_id}`); onClose() }}
                  onDismiss={() => dismissOne(alert.id)}
                  sending={sendingWa === alert.id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex justify-between items-center">
          <button onClick={load} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700">
            <RefreshCw className="h-3.5 w-3.5" /> Actualizar
          </button>
          <span className="text-xs text-gray-400">Próximos 7 días · Hoy</span>
        </div>
      </div>
    </div>
  )
}

function AlertCard({ alert, onWhatsApp, onViewLoan, onDismiss, sending }: {
  alert: Alert; onWhatsApp: () => void; onViewLoan: () => void; onDismiss: () => void; sending: boolean
}) {
  const isOverdue = alert.type === 'overdue'

  return (
    <div className={`px-5 py-4 hover:bg-gray-50 transition-colors ${isOverdue ? 'border-l-4 border-red-400' : 'border-l-4 border-amber-400'}`}>
      {/* Badge */}
      <div className="flex items-center gap-2 mb-2">
        {isOverdue
          ? <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold"><AlertTriangle className="h-3 w-3" /> {alert.days_overdue} días de atraso</span>
          : <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold"><Clock className="h-3 w-3" /> Vence en {alert.days_until} día{alert.days_until !== 1 ? 's' : ''}</span>
        }
      </div>

      {/* Info */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="font-semibold text-gray-900 text-sm">{alert.customer_name}</p>
          <p className="text-xs text-gray-400 mt-0.5">{alert.customer_code} · {alert.customer_phone}</p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-600">
            <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" />{alert.loan_number}</span>
            <span>Cuota #{alert.installment_number}</span>
            <span className="font-semibold text-gray-900">{fmt(alert.balance_due)}</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Vence: {fmtDate(alert.due_date)}</p>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex gap-2 mt-3">
        <button onClick={onViewLoan}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
          <CreditCard className="h-3.5 w-3.5" /> Ver préstamo
        </button>
        <button onClick={onWhatsApp} disabled={sending || !alert.wa_url_reminder}
          title={!alert.wa_url_reminder ? 'Sin WhatsApp registrado' : 'Enviar recordatorio'}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${alert.wa_url_reminder ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-100 text-gray-400'}`}>
          <MessageCircle className="h-3.5 w-3.5" />
          {sending ? 'Abriendo...' : alert.wa_url_reminder ? 'WhatsApp' : 'Sin WA'}
        </button>
        <button onClick={onDismiss} title="Marcar como vista"
          className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-400">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
