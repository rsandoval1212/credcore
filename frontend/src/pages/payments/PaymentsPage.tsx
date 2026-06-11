import { useState, useEffect, useCallback } from 'react'
import ExportButton from '@/components/ui/ExportButton'
import {
  DollarSign, Search, RefreshCw, Filter, Plus,
  ChevronLeft, ChevronRight, CheckCircle,
  Banknote, CreditCard, Building2, Clock,
} from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import DateRangeFilter, { type DateRange } from '@/components/filters/DateRangeFilter'
import PaymentFormModal from './PaymentFormModal'
import ReceiptWhatsAppButton from '@/components/notifications/ReceiptWhatsAppButton'

interface Payment {
  id: string; payment_number: string; receipt_number: string
  loan_number: string; customer_name: string; customer_code: string
  total_amount: number; principal_amount: number; interest_amount: number
  late_fee_amount: number; payment_type: string; payment_type_display: string
  payment_method: string; payment_method_display: string
  status: string; payment_date: string; received_by_name: string
}
interface Stats {
  today_count: number; today_amount: number; month_count: number; month_amount: number
  cash_amount: number; transfer_amount: number
}

const METHOD_ICONS: Record<string, React.ReactNode> = {
  CASH: <Banknote className="h-3.5 w-3.5 text-emerald-600" />,
  BANK_TRANSFER: <Building2 className="h-3.5 w-3.5 text-blue-600" />,
  CHECK: <CheckCircle className="h-3.5 w-3.5 text-purple-600" />,
  CARD: <CreditCard className="h-3.5 w-3.5 text-amber-600" />,
}
const TYPE_COLORS: Record<string, string> = {
  REGULAR: 'bg-emerald-100 text-emerald-700', PARTIAL: 'bg-amber-100 text-amber-700',
  EXTRAORDINARY: 'bg-blue-100 text-blue-700', FULL_PAYMENT: 'bg-purple-100 text-purple-700',
  LATE_FEE: 'bg-red-100 text-red-700',
}
const fmt = (n?: number | null) => n == null ? '—' : new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n)
const fmtDate = (d?: string) => !d ? '—' : new Date(d + 'T00:00:00').toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [dateRange, setDateRange] = useState<DateRange | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page }
      if (search) params.search = search
      if (methodFilter) params.payment_method = methodFilter
      if (typeFilter) params.payment_type = typeFilter
      if (dateRange) {
        params.payment_date__gte = dateRange.from
        params.payment_date__lte = dateRange.to
      }
      const r = await api.get('/payments/', { params })
      setPayments(r.data.results); setTotalPages(r.data.total_pages || 1); setTotalCount(r.data.count || 0)
    } catch { toast.error('Error cargando cobros') }
    finally { setLoading(false) }
  }, [page, search, methodFilter, typeFilter, dateRange])

  const loadStats = useCallback(async () => {
    try { const r = await api.get('/payments/stats/'); setStats(r.data) } catch {}
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadStats() }, [loadStats])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cobros</h1>
          <p className="text-sm text-gray-500 mt-1">{totalCount} pagos registrados</p>
        </div>
        <div className="flex gap-2">
          <ExportButton endpoint="/api/v1/reports/export/payments/" label="Exportar Excel" variant="outline" />
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">
            <Plus className="h-4 w-4" /> Registrar Cobro
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Cobros Hoy" value={fmt(stats.today_amount)} sub={`${stats.today_count} transacciones`} color="blue" icon={<Clock className="h-5 w-5 text-blue-600" />} />
          <StatCard label="Este Mes" value={fmt(stats.month_amount)} sub={`${stats.month_count} transacciones`} color="emerald" icon={<CheckCircle className="h-5 w-5 text-emerald-600" />} />
          <StatCard label="En Efectivo" value={fmt(stats.cash_amount)} sub="total histórico" color="amber" icon={<Banknote className="h-5 w-5 text-amber-600" />} />
          <StatCard label="Transferencias" value={fmt(stats.transfer_amount)} sub="total histórico" color="purple" icon={<Building2 className="h-5 w-5 text-purple-600" />} />
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-52 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input placeholder="Recibo, préstamo, cliente..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <select value={methodFilter} onChange={e => { setMethodFilter(e.target.value); setPage(1) }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">Todos los métodos</option>
          <option value="CASH">Efectivo</option>
          <option value="BANK_TRANSFER">Transferencia</option>
          <option value="CHECK">Cheque</option>
          <option value="CARD">Tarjeta</option>
        </select>
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">Todos los tipos</option>
          <option value="REGULAR">Regular</option>
          <option value="PARTIAL">Parcial</option>
          <option value="EXTRAORDINARY">Extraordinario</option>
          <option value="FULL_PAYMENT">Cancelación Total</option>
        </select>
        <button onClick={() => { load(); loadStats() }} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50"><RefreshCw className="h-4 w-4 text-gray-500" /></button>
        {(search || methodFilter || typeFilter || dateRange) && (
          <button onClick={() => { setSearch(''); setMethodFilter(''); setTypeFilter(''); setDateRange(null); setPage(1) }} className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
            <Filter className="h-3 w-3" /> Limpiar
          </button>
        )}
        <DateRangeFilter value={dateRange} onChange={r => { setDateRange(r); setPage(1) }} className="mt-3 w-full" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20"><RefreshCw className="h-6 w-6 text-primary-500 animate-spin" /></div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <DollarSign className="h-12 w-12 mb-3 opacity-30" />
            <p className="font-medium">No hay cobros registrados</p>
            <button onClick={() => setShowForm(true)} className="mt-4 flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm"><Plus className="h-4 w-4" /> Registrar primer cobro</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Recibo', 'Cliente', 'Préstamo', 'Tipo', 'Método', 'Total', 'Capital', 'Interés', 'Fecha', 'Recibido por', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3"><p className="font-mono text-xs font-semibold text-gray-900">{p.receipt_number}</p><p className="text-xs text-gray-400">{p.payment_number}</p></td>
                    <td className="px-4 py-3"><p className="font-medium text-gray-900">{p.customer_name}</p><p className="text-xs text-gray-400">{p.customer_code}</p></td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.loan_number}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[p.payment_type] || 'bg-gray-100 text-gray-600'}`}>{p.payment_type_display}</span></td>
                    <td className="px-4 py-3"><span className="flex items-center gap-1 text-xs text-gray-600">{METHOD_ICONS[p.payment_method] || <DollarSign className="h-3.5 w-3.5" />}{p.payment_method_display}</span></td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(p.total_amount)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmt(p.principal_amount)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmt(p.interest_amount)}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{fmtDate(p.payment_date)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{p.received_by_name}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <ReceiptWhatsAppButton paymentId={p.id} />
                        <ExportButton
                          endpoint={`/api/v1/reports/pdf/receipt/${p.id}/`}
                          label=""
                          variant="ghost"
                          className="p-1.5 border border-gray-200 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">Página {page} de {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>
      {showForm && <PaymentFormModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); loadStats() }} />}
    </div>
  )
}

function StatCard({ label, value, sub, color, icon }: { label: string; value: string; sub: string; color: string; icon: React.ReactNode }) {
  const c: Record<string, string> = { blue: 'bg-blue-50 border-blue-100', emerald: 'bg-emerald-50 border-emerald-100', amber: 'bg-amber-50 border-amber-100', purple: 'bg-purple-50 border-purple-100' }
  return (
    <div className={`rounded-xl border p-4 ${c[color] || 'bg-gray-50 border-gray-100'}`}>
      <div className="flex items-center gap-2 mb-2 text-gray-500">{icon}<p className="text-xs font-medium">{label}</p></div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}
