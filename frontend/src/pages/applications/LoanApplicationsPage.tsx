import { useState, useEffect, useCallback } from 'react'
import {
  FileText, Plus, Search, Filter, RefreshCw, Eye,
  ChevronLeft, ChevronRight, Clock, CheckCircle,
  XCircle, Send, AlertTriangle, Banknote, BarChart3,
} from 'lucide-react'
import { applicationsService } from '@/services/applications'
import type { LoanApplication, ApplicationStatus, ApplicationStats } from '@/types'
import toast from 'react-hot-toast'
import DateRangeFilter, { type DateRange } from '@/components/filters/DateRangeFilter'
import ApplicationFormModal from './ApplicationFormModal'
import ApplicationDetailModal from './ApplicationDetailModal'

// ── Colores por estado ────────────────────────────────────────────────────────
const STATUS_META: Record<ApplicationStatus, { label: string; color: string; icon: React.ReactNode }> = {
  DRAFT:        { label: 'Borrador',     color: 'bg-gray-100 text-gray-600',      icon: <FileText className="h-3 w-3" /> },
  SUBMITTED:    { label: 'Enviada',      color: 'bg-blue-100 text-blue-700',      icon: <Send className="h-3 w-3" /> },
  UNDER_REVIEW: { label: 'En Revisión', color: 'bg-amber-100 text-amber-700',    icon: <Clock className="h-3 w-3" /> },
  APPROVED:     { label: 'Aprobada',    color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle className="h-3 w-3" /> },
  REJECTED:     { label: 'Rechazada',   color: 'bg-red-100 text-red-700',         icon: <XCircle className="h-3 w-3" /> },
  CANCELLED:    { label: 'Cancelada',   color: 'bg-gray-100 text-gray-500',       icon: <XCircle className="h-3 w-3" /> },
  DISBURSED:    { label: 'Desembolsada',color: 'bg-purple-100 text-purple-700',   icon: <Banknote className="h-3 w-3" /> },
}

const RISK_COLORS: Record<string, string> = {
  LOW: 'text-blue-600', MEDIUM: 'text-amber-600', HIGH: 'text-red-600',
}

function fmt(n?: number | null) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n)
}
function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function LoanApplicationsPage() {
  const [applications, setApplications] = useState<LoanApplication[]>([])
  const [stats, setStats] = useState<ApplicationStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateRange, setDateRange] = useState<DateRange | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [selectedApp, setSelectedApp] = useState<LoanApplication | null>(null)

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
      const res = await applicationsService.list(params)
      setApplications(res.data.results)
      setTotalPages(res.data.total_pages || 1)
      setTotalCount(res.data.count || 0)
    } catch {
      toast.error('Error cargando solicitudes')
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter, dateRange])

  const loadStats = useCallback(async () => {
    try {
      const r = await applicationsService.stats()
      setStats(r.data)
    } catch {}
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadStats() }, [loadStats])

  const handleRefresh = () => { load(); loadStats() }

  const openDetail = async (app: LoanApplication) => {
    try {
      const r = await applicationsService.get(app.id)
      setSelectedApp(r.data)
    } catch {
      setSelectedApp(app)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Solicitudes de Préstamo</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">{totalCount} solicitudes en total</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors"
        >
          <Plus className="h-4 w-4" /> Nueva Solicitud
        </button>
      </div>

      {/* Stats pipeline */}
      {stats && (
        <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
          {(Object.entries(STATUS_META) as [ApplicationStatus, typeof STATUS_META[ApplicationStatus]][]).map(([key, meta]) => {
            const count = stats[key as keyof ApplicationStats] as number ?? 0
            return (
              <button
                key={key}
                onClick={() => { setStatusFilter(key); setPage(1) }}
                className={`flex flex-col items-center p-3 rounded-xl border transition-all hover:shadow-sm ${statusFilter === key ? 'ring-2 ring-primary-400 ' : ''}${meta.color.replace('text-', 'border-').replace('bg-', 'bg-').split(' ')[0]} bg-white border-gray-100`}
              >
                <span className={`text-xl font-black ${meta.color.split(' ')[1]}`}>{count}</span>
                <span className="text-xs text-gray-500 mt-0.5 text-center leading-tight">{meta.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Totales financieros */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 sm:p-4">
            <p className="text-xs text-blue-500 font-semibold uppercase">Total solicitado</p>
            <p className="text-lg sm:text-2xl font-black text-blue-700 mt-1 truncate" title={fmt(stats.total_requested)}>{fmt(stats.total_requested)}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 sm:p-4">
            <p className="text-xs text-emerald-500 font-semibold uppercase">Total aprobado</p>
            <p className="text-lg sm:text-2xl font-black text-emerald-700 mt-1 truncate" title={fmt(stats.total_approved)}>{fmt(stats.total_approved)}</p>
          </div>
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
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Todos los estados</option>
            {(Object.entries(STATUS_META) as [ApplicationStatus, typeof STATUS_META[ApplicationStatus]][]).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <button onClick={handleRefresh} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
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
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-6 w-6 text-primary-500 animate-spin" />
          </div>
        ) : applications.length === 0 ? (
          <EmptyState onNew={() => setShowForm(true)} filtered={!!(statusFilter || search)} />
        ) : (
          <>
            {/* Cards mobile */}
            <div className="md:hidden divide-y divide-gray-100">
              {applications.map(app => {
                const meta = STATUS_META[app.status]
                return (
                  <div key={app.id}
                    onClick={() => openDetail(app)}
                    className="p-3 cursor-pointer hover:bg-gray-50 active:bg-gray-100">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">{app.customer_name}</p>
                        <p className="font-mono text-xs text-gray-500">{app.application_number}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${meta.color}`}>
                        {meta.icon}{meta.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                      <div>
                        <p className="text-gray-400">Solicita</p>
                        <p className="font-semibold text-gray-900 truncate">{fmt(app.requested_amount)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Cuota est.</p>
                        <p className="font-semibold text-gray-700 truncate">{fmt(app.monthly_payment_estimate)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[11px] text-gray-500">
                      <span>{app.product_name} · {app.requested_term_months}m</span>
                      <span>{fmtDate(app.submitted_at || app.created_at)}</span>
                    </div>
                    {(app.debt_to_income_ratio != null || app.risk_level) && (
                      <div className="flex items-center gap-2 mt-2 text-[10px]">
                        {app.debt_to_income_ratio != null && (
                          <span className={`px-1.5 py-0.5 rounded-full font-semibold ${Number(app.debt_to_income_ratio) > 50 ? 'bg-red-50 text-red-600' : Number(app.debt_to_income_ratio) > 35 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            DTI {Number(app.debt_to_income_ratio).toFixed(1)}%
                          </span>
                        )}
                        {app.risk_level && (
                          <span className={`px-1.5 py-0.5 rounded-full font-semibold ${RISK_COLORS[app.risk_level] || 'text-gray-400'} bg-gray-50`}>
                            Riesgo {app.risk_level === 'LOW' ? 'Bajo' : app.risk_level === 'MEDIUM' ? 'Medio' : 'Alto'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Tabla desktop */}
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Solicitud</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Cliente</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Producto</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Monto</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Plazo</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Cuota est.</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">DTI</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Riesgo</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Estado</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Fecha</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {applications.map(app => {
                  const meta = STATUS_META[app.status]
                  return (
                    <tr key={app.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => openDetail(app)}>
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-semibold text-gray-900">{app.application_number}</p>
                        <p className="text-xs text-gray-400">Paso {app.current_step}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{app.customer_name}</p>
                        <p className="text-xs text-gray-400">{app.customer_code}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-700">{app.product_name}</p>
                        <p className="text-xs text-gray-400">{app.product_code}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-semibold text-gray-900">{fmt(app.requested_amount)}</p>
                        {app.approved_amount && app.approved_amount !== app.requested_amount && (
                          <p className="text-xs text-emerald-600">Aprobado: {fmt(app.approved_amount)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {app.requested_term_months}m
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-gray-700">{fmt(app.monthly_payment_estimate)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {app.debt_to_income_ratio != null ? (
                          <span className={`font-semibold text-xs ${Number(app.debt_to_income_ratio) > 50 ? 'text-red-600' : Number(app.debt_to_income_ratio) > 35 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {Number(app.debt_to_income_ratio).toFixed(1)}%
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold ${RISK_COLORS[app.risk_level] || 'text-gray-400'}`}>
                          {app.risk_level === 'LOW' ? 'Bajo' : app.risk_level === 'MEDIUM' ? 'Medio' : app.risk_level === 'HIGH' ? 'Alto' : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
                          {meta.icon}{meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {fmtDate(app.submitted_at || app.created_at)}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openDetail(app)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600 transition-colors">
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
            <p className="text-xs sm:text-sm text-gray-500">Página {page} de {totalPages} · {totalCount} solicitudes</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <ApplicationFormModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); handleRefresh() }} />
      )}

      {selectedApp && (
        <ApplicationDetailModal
          application={selectedApp}
          onClose={() => setSelectedApp(null)}
          onUpdated={updated => { setSelectedApp(updated); handleRefresh() }}
        />
      )}
    </div>
  )
}

function EmptyState({ onNew, filtered }: { onNew: () => void; filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <BarChart3 className="h-12 w-12 mb-3 opacity-30" />
      <p className="font-medium">{filtered ? 'No hay solicitudes con esos filtros' : 'No hay solicitudes registradas'}</p>
      <p className="text-sm mt-1">{filtered ? 'Prueba cambiando los filtros' : 'Crea la primera solicitud de préstamo'}</p>
      {!filtered && (
        <button onClick={onNew} className="mt-4 flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
          <Plus className="h-4 w-4" /> Nueva Solicitud
        </button>
      )}
    </div>
  )
}

// re-export para evitar unused warning
export { AlertTriangle }
