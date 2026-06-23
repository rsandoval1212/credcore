import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ExportButton from '@/components/ui/ExportButton'
import {
  CreditCard, Search, Filter, RefreshCw, Eye,
  ChevronLeft, ChevronRight, AlertTriangle,
  CheckCircle, TrendingDown, TrendingUp, Banknote, Clock, Plus,
} from 'lucide-react'
import { loansService } from '@/services/loans'
import DateRangeFilter, { type DateRange } from '@/components/filters/DateRangeFilter'
import FilterChips from '@/components/ui/FilterChips'
import DirectLoanFormModal from './DirectLoanFormModal'
import type { Loan, LoanStatus, LoanStats } from '@/types'
import toast from 'react-hot-toast'

const STATUS_META: Record<LoanStatus, { label: string; color: string }> = {
  ACTIVE:      { label: 'Activo',       color: 'bg-emerald-100 text-emerald-700' },
  COMPLETED:   { label: 'Completado',   color: 'bg-blue-100 text-blue-700' },
  DEFAULTED:   { label: 'En Mora',      color: 'bg-red-100 text-red-700' },
  WRITTEN_OFF: { label: 'Castigado',    color: 'bg-gray-200 text-gray-600' },
  CANCELLED:   { label: 'Cancelado',    color: 'bg-gray-100 text-gray-500' },
  REFINANCED:  { label: 'Refinanciado', color: 'bg-purple-100 text-purple-700' },
}

function fmt(n?: number | null) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n)
}
function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function LoansPage() {
  const navigate = useNavigate()
  const [loans, setLoans] = useState<Loan[]>([])
  const [stats, setStats] = useState<LoanStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
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
      if (statusFilter) params.status = statusFilter
      if (dateRange) {
        params.created_at__date__gte = dateRange.from
        params.created_at__date__lte = dateRange.to
      }
      const res = await loansService.list(params)
      setLoans(res.data.results)
      setTotalPages(res.data.total_pages || 1)
      setTotalCount(res.data.count || 0)
    } catch {
      toast.error('Error cargando préstamos')
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter, dateRange])

  const loadStats = useCallback(async () => {
    try {
      const r = await loansService.stats()
      setStats(r.data)
    } catch {}
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadStats() }, [loadStats])

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Préstamos</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">{totalCount} préstamos en el sistema</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ExportButton
            endpoint="/api/v1/reports/export/loans/"
            label="Exportar Excel"
            variant="outline"
          />
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" /> Registrar Préstamo
          </button>
        </div>
      </div>

      {showForm && (
        <DirectLoanFormModal
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); loadStats() }}
        />
      )}

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            icon={<Banknote className="h-5 w-5 text-blue-600" />}
            label="Portafolio Activo"
            value={fmt(stats.total_portfolio)}
            sub={`${stats.active} préstamos activos`}
            color="blue"
          />
          <KPICard
            icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
            label="Total Desembolsado"
            value={fmt(stats.total_disbursed)}
            sub={`${stats.total} préstamos totales`}
            color="green"
          />
          <KPICard
            icon={<CheckCircle className="h-5 w-5 text-purple-600" />}
            label="Total Recuperado"
            value={fmt(stats.total_collected)}
            sub={`${stats.completed} completados`}
            color="purple"
          />
          <KPICard
            icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
            label="Cartera en Mora"
            value={fmt(stats.overdue_portfolio)}
            sub={`${stats.delinquency_rate}% tasa morosidad`}
            color="red"
          />
        </div>
      )}

      {/* Status chips */}
      {stats && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {(Object.entries(STATUS_META) as [LoanStatus, typeof STATUS_META[LoanStatus]][]).map(([key, meta]) => {
            const count = stats[key as keyof LoanStats] as number ?? 0
            return (
              <button key={key} onClick={() => { setStatusFilter(key); setPage(1) }}
                className={`flex flex-col items-center p-3 rounded-xl border bg-white transition-all hover:shadow-sm border-gray-100 ${statusFilter === key ? 'ring-2 ring-primary-400' : ''}`}>
                <span className={`text-xl font-black ${meta.color.split(' ')[1]}`}>{count}</span>
                <span className="text-xs text-gray-500 mt-0.5">{meta.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-52 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              placeholder="Buscar por número, cliente, cédula..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button onClick={() => { load(); loadStats() }} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
            <RefreshCw className="h-4 w-4 text-gray-500" />
          </button>
          {(statusFilter || search || dateRange) && (
            <button onClick={() => { setStatusFilter(''); setSearch(''); setDateRange(null); setPage(1) }}
              className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
              <Filter className="h-3 w-3" /> Limpiar
            </button>
          )}
        </div>
        <DateRangeFilter value={dateRange} onChange={r => { setDateRange(r); setPage(1) }} className="mt-3" />

        <FilterChips
          className="mt-3"
          chips={[
            { id: 'active', label: 'Activos', icon: '🟢', color: 'emerald' },
            { id: 'defaulted', label: 'En mora', icon: '🔴', color: 'red' },
            { id: 'completed', label: 'Completados', icon: '✓', color: 'blue' },
            { id: 'written-off', label: 'Castigados', icon: '⚫', color: 'gray' },
          ]}
          activeId={
            statusFilter === 'ACTIVE' ? 'active' :
            statusFilter === 'DEFAULTED' ? 'defaulted' :
            statusFilter === 'COMPLETED' ? 'completed' :
            statusFilter === 'WRITTEN_OFF' ? 'written-off' : null
          }
          onChange={(id) => {
            setPage(1)
            if (id === 'active') setStatusFilter('ACTIVE')
            else if (id === 'defaulted') setStatusFilter('DEFAULTED')
            else if (id === 'completed') setStatusFilter('COMPLETED')
            else if (id === 'written-off') setStatusFilter('WRITTEN_OFF')
            else setStatusFilter('')
          }}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-6 w-6 text-primary-500 animate-spin" />
          </div>
        ) : loans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <CreditCard className="h-12 w-12 mb-3 opacity-30" />
            <p className="font-medium">No hay préstamos{statusFilter || search ? ' con esos filtros' : ' registrados'}</p>
            <p className="text-sm mt-1">Usa "Registrar Préstamo" o aprueba una solicitud para crear uno</p>
          </div>
        ) : (
          <>
            {/* Cards mobile */}
            <div className="md:hidden divide-y divide-gray-100">
              {loans.map(loan => {
                const meta = STATUS_META[loan.status]
                const progress = loan.installments_paid + loan.installments_remaining > 0
                  ? (loan.installments_paid / (loan.installments_paid + loan.installments_remaining)) * 100
                  : 0
                const isOverdue = loan.days_past_due > 0
                return (
                  <div key={loan.id}
                    onClick={() => navigate(`/loans/${loan.id}`)}
                    className={`p-3 cursor-pointer hover:bg-gray-50 active:bg-gray-100 ${isOverdue ? 'bg-red-50/30' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">{loan.customer_name}</p>
                        <p className="font-mono text-xs text-gray-500">{loan.loan_number}</p>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${meta.color}`}>
                        {meta.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                      <div>
                        <p className="text-gray-400">Saldo</p>
                        <p className={`font-semibold ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                          {fmt(loan.total_outstanding ?? (loan.outstanding_principal + loan.outstanding_interest + loan.outstanding_late_fees))}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Cuota</p>
                        <p className="font-semibold text-gray-700">{fmt(loan.monthly_payment)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
                          <span>{loan.installments_paid}/{loan.installments_paid + loan.installments_remaining} cuotas</span>
                          {isOverdue && <span className="text-red-600 font-semibold">{loan.days_past_due}d mora</span>}
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-primary-400 rounded-full" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Tabla desktop / tablet */}
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Préstamo</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Cliente</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Producto</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Capital</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Saldo</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Cuota</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Avance</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Mora</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Estado</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Vence</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loans.map(loan => {
                  const meta = STATUS_META[loan.status]
                  const progress = loan.installments_paid + loan.installments_remaining > 0
                    ? (loan.installments_paid / (loan.installments_paid + loan.installments_remaining)) * 100
                    : 0
                  const isOverdue = loan.days_past_due > 0

                  return (
                    <tr key={loan.id} className={`hover:bg-gray-50 transition-colors cursor-pointer ${isOverdue ? 'bg-red-50/30' : ''}`}
                      onClick={() => navigate(`/loans/${loan.id}`)}>
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-semibold text-gray-900">{loan.loan_number}</p>
                        <p className="text-xs text-gray-400">{fmtDate(loan.disbursement_date)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{loan.customer_name}</p>
                        <p className="text-xs text-gray-400">{loan.customer_code}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{loan.product_name}</td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-semibold text-gray-900">{fmt(loan.principal_amount)}</p>
                        <p className="text-xs text-gray-400">{loan.annual_interest_rate}% anual</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className={`font-semibold ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                          {fmt(loan.total_outstanding ?? (loan.outstanding_principal + loan.outstanding_interest + loan.outstanding_late_fees))}
                        </p>
                        {loan.outstanding_late_fees > 0 && (
                          <p className="text-xs text-red-500">+{fmt(loan.outstanding_late_fees)} mora</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmt(loan.monthly_payment)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs text-gray-500">{loan.installments_paid}/{loan.installments_paid + loan.installments_remaining}</span>
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-primary-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isOverdue ? (
                          <span className="flex items-center gap-1 justify-center text-xs font-semibold text-red-600">
                            <TrendingDown className="h-3 w-3" />{loan.days_past_due}d
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(loan.maturity_date)}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <button onClick={() => navigate(`/loans/${loan.id}`)}
                          className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600 transition-colors">
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">Página {page} de {totalPages} · {totalCount} préstamos</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function KPICard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string; color: string
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-100',
    green: 'bg-emerald-50 border-emerald-100',
    purple: 'bg-purple-50 border-purple-100',
    red: 'bg-red-50 border-red-100',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color] || 'bg-gray-50 border-gray-100'}`}>
      <div className="flex items-center gap-2 mb-2 text-gray-500">{icon}<p className="text-xs font-medium">{label}</p></div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// Evitar unused warning del import Clock
export { Clock }
