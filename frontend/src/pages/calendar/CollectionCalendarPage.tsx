import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, AlertTriangle, MessageCircle, Phone } from 'lucide-react'
import api from '@/services/api'
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
  start: string
  end: string
  total_count: number
  total_amount: number
  overdue_count: number
  by_date: Record<string, Item[]>
  items: Item[]
}

const fmt = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n)
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function formatWaPhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits
  if (digits.length === 10) return '1' + digits
  return digits
}

export default function CollectionCalendarPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [refDate, setRefDate] = useState(new Date())

  const monthStart = useMemo(() => new Date(refDate.getFullYear(), refDate.getMonth(), 1), [refDate])
  const monthEnd = useMemo(() => new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0), [refDate])

  const load = async () => {
    setLoading(true)
    try {
      const start = monthStart.toISOString().slice(0, 10)
      const end = monthEnd.toISOString().slice(0, 10)
      const r = await api.get<Data>('/loans/collection-calendar/', { params: { start, end } })
      setData(r.data)
    } catch {
      setData({ start: '', end: '', total_count: 0, total_amount: 0, overdue_count: 0, by_date: {}, items: [] })
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [refDate]) // eslint-disable-line

  const calendarCells = useMemo(() => {
    const firstDow = monthStart.getDay()
    const daysInMonth = monthEnd.getDate()
    const cells: { date: Date | null }[] = []
    for (let i = 0; i < firstDow; i++) cells.push({ date: null })
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(refDate.getFullYear(), refDate.getMonth(), d) })
    }
    while (cells.length % 7 !== 0) cells.push({ date: null })
    return cells
  }, [refDate, monthStart, monthEnd])

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-primary-600" />
            Calendario de Cobros
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Visualiza qué cuotas vencen cada día</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setRefDate(new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1))}
            className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[140px] text-center">
            {MONTHS[refDate.getMonth()]} {refDate.getFullYear()}
          </span>
          <button onClick={() => setRefDate(new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1))}
            className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button onClick={() => setRefDate(new Date())}
            className="ml-2 px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
            Hoy
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {loading ? (
          <>
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </>
        ) : (
          <>
            <StatCard label="Cuotas a cobrar" value={String(data?.total_count || 0)} sub="en el mes" />
            <StatCard label="Monto pendiente" value={fmt(data?.total_amount || 0)} sub="total a recuperar" />
            <StatCard label="Vencidas" value={String(data?.overdue_count || 0)} sub="requieren acción" alert={data && data.overdue_count > 0} />
          </>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700">
          {DAYS.map(d => (
            <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">{d}</div>
          ))}
        </div>
        {loading ? (
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-24 border-r border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {calendarCells.map((cell, i) => {
              const iso = cell.date ? cell.date.toISOString().slice(0, 10) : ''
              const dayItems = (data?.by_date[iso] || [])
              const isToday = iso === today
              const isPast = iso && iso < today
              const totalDay = dayItems.reduce((s, it) => s + it.remaining, 0)
              return (
                <div key={i}
                  className={`min-h-[100px] p-1.5 border-r border-b border-gray-100 dark:border-gray-700 ${cell.date ? '' : 'bg-gray-50/30 dark:bg-gray-900/30'} ${isToday ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}>
                  {cell.date && (
                    <>
                      <div className={`text-xs font-semibold mb-1 flex items-center justify-between ${isToday ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'}`}>
                        <span>{cell.date.getDate()}</span>
                        {dayItems.length > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isPast ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'}`}>
                            {dayItems.length}
                          </span>
                        )}
                      </div>
                      {dayItems.length > 0 && (
                        <div className="space-y-0.5">
                          {dayItems.slice(0, 2).map(it => (
                            <button key={it.id}
                              onClick={() => navigate(`/loans/${it.loan_id}`)}
                              title={`${it.customer_name} · Cuota ${it.installment_number} · ${fmt(it.remaining)}`}
                              className={`block w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate ${it.is_overdue ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300'} hover:opacity-80`}>
                              {it.customer_name.split(' ')[0]} {fmt(it.remaining)}
                            </button>
                          ))}
                          {dayItems.length > 2 && (
                            <p className="text-[10px] text-gray-400 px-1.5">+{dayItems.length - 2} más · {fmt(totalDay)}</p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Cuotas vencidas
          </h2>
          <span className="text-xs text-gray-400">{data?.overdue_count || 0} pendientes</span>
        </div>
        {loading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : data && data.items.filter(i => i.is_overdue).length === 0 ? (
          <EmptyState title="Sin cuotas vencidas" description="Excelente, todos al día este mes." />
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-700">
            {data?.items.filter(i => i.is_overdue).slice(0, 20).map(it => (
              <div key={it.id} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{it.customer_name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {it.loan_number} · Cuota #{it.installment_number} · venció el {it.due_date}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-600">{fmt(it.remaining)}</p>
                  <p className="text-[10px] text-red-500">{Math.abs(it.days_until_due)} días atrás</p>
                </div>
                <div className="flex gap-1">
                  {it.customer_phone && (
                    <a href={`https://wa.me/${formatWaPhone(it.customer_phone)}?text=${encodeURIComponent(`Estimado/a ${it.customer_name}, su cuota #${it.installment_number} por ${fmt(it.remaining)} venció el ${it.due_date}. Comuníquese con nosotros.`)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="p-1.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-100">
                      <MessageCircle className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button onClick={() => navigate(`/loans/${it.loan_id}`)}
                    className="p-1.5 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-lg hover:bg-primary-100">
                    <Phone className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, alert }: { label: string; value: string; sub: string; alert?: boolean | null }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border ${alert ? 'border-red-200 dark:border-red-900' : 'border-gray-200 dark:border-gray-700'} p-4`}>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${alert ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  )
}
