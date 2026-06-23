import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Route, CheckCircle2, XCircle, MessageCircle,
  Phone, RefreshCw, AlertTriangle, ChevronRight,
} from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/Skeleton'

interface Item {
  id: string
  loan_id: string
  loan_number: string
  customer_name: string
  customer_phone: string
  installment_number: number
  due_date: string
  total_amount: number
  remaining: number
  status: string
  is_overdue: boolean
  days_until_due: number
}

interface Data {
  items: Item[]
  total_count: number
  total_amount: number
  overdue_count: number
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n)

function formatWaPhone(phone: string): string {
  const d = (phone || '').replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('1')) return d
  if (d.length === 10) return '1' + d
  return d
}

type Visit = 'pending' | 'paid' | 'partial' | 'not_paid'

export default function CollectionRoutePage() {
  const navigate = useNavigate()
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [visits, setVisits] = useState<Record<string, Visit>>(() => {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const stored = localStorage.getItem(`credcore-route-${today}`)
      return stored ? JSON.parse(stored) : {}
    } catch { return {} }
  })

  const saveVisits = (v: Record<string, Visit>) => {
    setVisits(v)
    const today = new Date().toISOString().slice(0, 10)
    localStorage.setItem(`credcore-route-${today}`, JSON.stringify(v))
  }

  const load = async () => {
    setLoading(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      // pedir cuotas que vencen hoy + atrasadas (start = hace 60 días, end = hoy)
      const from = new Date(); from.setDate(from.getDate() - 60)
      const r = await api.get<Data>('/loans/collection-calendar/', {
        params: { start: from.toISOString().slice(0, 10), end: today }
      })
      // Solo dejar las del día actual + atrasadas
      const filtered = r.data.items.filter(i => i.is_overdue || i.due_date === today)
      setData({
        items: filtered,
        total_count: filtered.length,
        total_amount: filtered.reduce((s, i) => s + i.remaining, 0),
        overdue_count: filtered.filter(i => i.is_overdue).length,
      })
    } catch {
      toast.error('Error cargando ruta')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const markVisit = (id: string, v: Visit) => {
    saveVisits({ ...visits, [id]: v })
  }

  const pendingCount = data ? data.items.filter(i => !visits[i.id] || visits[i.id] === 'pending').length : 0
  const paidCount = data ? data.items.filter(i => visits[i.id] === 'paid').length : 0
  const notPaidCount = data ? data.items.filter(i => visits[i.id] === 'not_paid').length : 0
  const collectedAmount = data ? data.items.filter(i => visits[i.id] === 'paid').reduce((s, i) => s + i.remaining, 0) : 0
  const progress = data && data.total_count > 0 ? Math.round(((paidCount + notPaidCount) / data.total_count) * 100) : 0

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Route className="h-6 w-6 text-primary-600" />
          Mi Ruta de Cobro
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {new Date().toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Progreso */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Progreso del día</span>
          <span className="text-xs font-bold text-primary-600">{progress}%</span>
        </div>
        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary-500 to-emerald-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="grid grid-cols-4 gap-2 mt-3 text-center">
          <Stat label="Total" value={data?.total_count || 0} color="text-gray-700 dark:text-gray-300" />
          <Stat label="Cobrados" value={paidCount} color="text-emerald-600" />
          <Stat label="No pagó" value={notPaidCount} color="text-red-600" />
          <Stat label="Pendientes" value={pendingCount} color="text-amber-600" />
        </div>
        {collectedAmount > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-center">
            <p className="text-xs text-gray-500">Recaudado hoy</p>
            <p className="text-2xl font-bold text-emerald-700">{fmt(collectedAmount)}</p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-8 w-8 text-emerald-500" />}
          title="¡Sin cobros pendientes!"
          description="No hay cuotas que cobrar hoy ni atrasadas."
        />
      ) : (
        <div className="space-y-2">
          {/* Pendientes arriba */}
          {[...data.items]
            .sort((a, b) => {
              const va = visits[a.id] || 'pending'
              const vb = visits[b.id] || 'pending'
              if (va === 'pending' && vb !== 'pending') return -1
              if (vb === 'pending' && va !== 'pending') return 1
              if (a.is_overdue && !b.is_overdue) return -1
              if (b.is_overdue && !a.is_overdue) return 1
              return 0
            })
            .map(item => (
              <RouteCard
                key={item.id}
                item={item}
                visit={visits[item.id] || 'pending'}
                onMark={(v) => markVisit(item.id, v)}
                onOpenLoan={() => navigate(`/loans/${item.loan_id}`)}
              />
            ))}
        </div>
      )}

      <button onClick={load} className="w-full flex items-center justify-center gap-2 py-3 text-xs text-gray-500 hover:text-gray-700">
        <RefreshCw className="h-3.5 w-3.5" /> Actualizar lista
      </button>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-500 uppercase">{label}</p>
    </div>
  )
}

function RouteCard({ item, visit, onMark, onOpenLoan }: {
  item: Item; visit: Visit; onMark: (v: Visit) => void; onOpenLoan: () => void
}) {
  const done = visit !== 'pending'
  const wa = item.customer_phone ? `https://wa.me/${formatWaPhone(item.customer_phone)}` : ''
  const tel = item.customer_phone ? `tel:+${formatWaPhone(item.customer_phone)}` : ''

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border-2 transition-all ${
      visit === 'paid' ? 'border-emerald-300 dark:border-emerald-700 opacity-60' :
      visit === 'not_paid' ? 'border-red-300 dark:border-red-700 opacity-60' :
      visit === 'partial' ? 'border-amber-300 dark:border-amber-700' :
      item.is_overdue ? 'border-red-200 dark:border-red-900' : 'border-gray-200 dark:border-gray-700'
    } p-4`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {item.is_overdue && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
            <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{item.customer_name}</p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {item.loan_number} · Cuota #{item.installment_number}
            {item.is_overdue && <span className="text-red-600 font-medium"> · {Math.abs(item.days_until_due)} días atrás</span>}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{fmt(item.remaining)}</p>
        </div>
      </div>

      {!done ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          <button onClick={() => onMark('paid')}
            className="flex items-center justify-center gap-1 py-2 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Pagó
          </button>
          <button onClick={() => onMark('not_paid')}
            className="flex items-center justify-center gap-1 py-2 text-xs font-medium border border-red-200 text-red-700 bg-red-50 rounded-lg hover:bg-red-100">
            <XCircle className="h-3.5 w-3.5" /> No pagó
          </button>
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 py-2 text-xs font-medium border border-green-200 text-green-700 bg-green-50 rounded-lg hover:bg-green-100">
              <MessageCircle className="h-3.5 w-3.5" /> WA
            </a>
          )}
          {tel && (
            <a href={tel}
              className="flex items-center justify-center gap-1 py-2 text-xs font-medium border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50">
              <Phone className="h-3.5 w-3.5" /> Llamar
            </a>
          )}
          <button onClick={onOpenLoan}
            className="col-span-2 sm:col-span-4 flex items-center justify-center gap-1 py-1.5 text-[11px] text-primary-600 hover:underline">
            Ver préstamo <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className={`text-xs font-bold ${visit === 'paid' ? 'text-emerald-700' : 'text-red-700'}`}>
            {visit === 'paid' ? '✓ COBRADO' : '✗ NO PAGÓ'}
          </span>
          <button onClick={() => onMark('pending')}
            className="text-xs text-gray-500 hover:text-gray-700 underline">Deshacer</button>
        </div>
      )}
    </div>
  )
}
