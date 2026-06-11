import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ExportButton from '@/components/ui/ExportButton'
import {
  Users, Plus, Search, Filter, Download, RefreshCw,
  UserCheck, UserX, AlertTriangle, Eye, Phone, Mail, Upload, X, CheckCircle,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { customersService } from '@/services/customers'
import type { Customer, CustomerStatus, RiskLevel } from '@/types'
import toast from 'react-hot-toast'
import DateRangeFilter, { type DateRange } from '@/components/filters/DateRangeFilter'
import CustomerFormModal from './CustomerFormModal'

const STATUS_COLORS: Record<CustomerStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  INACTIVE: 'bg-gray-100 text-gray-600',
  BLOCKED: 'bg-red-100 text-red-700',
}
const RISK_COLORS: Record<RiskLevel, string> = {
  LOW: 'bg-blue-100 text-blue-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  HIGH: 'bg-red-100 text-red-700',
}
const RISK_LABELS: Record<RiskLevel, string> = { LOW: 'Bajo', MEDIUM: 'Medio', HIGH: 'Alto' }

function fmt(n: number) {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n)
}

export default function CustomersPage() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [riskFilter, setRiskFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [dateRange, setDateRange] = useState<DateRange | null>(null)
  const [showForm, setShowForm]     = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [stats, setStats] = useState({ active: 0, inactive: 0, blocked: 0, high_risk: 0 })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page }
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      if (riskFilter) params.risk_level = riskFilter
      if (dateRange) {
        params.created_at__date__gte = dateRange.from
        params.created_at__date__lte = dateRange.to
      }
      const res = await customersService.list(params)
      setCustomers(res.data.results)
      setTotalPages(res.data.total_pages || 1)
      setTotalCount(res.data.count || 0)
    } catch {
      toast.error('Error cargando clientes')
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter, riskFilter, dateRange])

  const loadStats = useCallback(async () => {
    try {
      const [active, inactive, blocked, highRisk] = await Promise.all([
        customersService.list({ status: 'ACTIVE', page_size: 1 }),
        customersService.list({ status: 'INACTIVE', page_size: 1 }),
        customersService.list({ status: 'BLOCKED', page_size: 1 }),
        customersService.list({ risk_level: 'HIGH', page_size: 1 }),
      ])
      setStats({
        active: active.data.count,
        inactive: inactive.data.count,
        blocked: blocked.data.count,
        high_risk: highRisk.data.count,
      })
    } catch {}
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadStats() }, [loadStats])

  const handleSearch = (v: string) => { setSearch(v); setPage(1) }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-1">{totalCount} clientes registrados</p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            endpoint="/api/v1/reports/export/customers/"
            label="Exportar Excel"
            variant="outline"
          />
          <ExportButton
            endpoint="/api/v1/reports/import/template/"
            label="Plantilla Importar"
            variant="outline"
            className="border-amber-300 text-amber-700 hover:bg-amber-50"
          />
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 border border-emerald-300 text-emerald-700 bg-white rounded-lg hover:bg-emerald-50 transition-colors font-medium text-sm"
          >
            <Download className="h-4 w-4" />
            Importar Excel
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            <Plus className="h-4 w-4" />
            Nuevo Cliente
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<UserCheck className="h-5 w-5 text-emerald-600" />} label="Activos" value={stats.active} color="bg-emerald-50 border-emerald-100" onClick={() => { setStatusFilter('ACTIVE'); setPage(1) }} />
        <StatCard icon={<Users className="h-5 w-5 text-gray-500" />} label="Inactivos" value={stats.inactive} color="bg-gray-50 border-gray-100" onClick={() => { setStatusFilter('INACTIVE'); setPage(1) }} />
        <StatCard icon={<UserX className="h-5 w-5 text-red-600" />} label="Bloqueados" value={stats.blocked} color="bg-red-50 border-red-100" onClick={() => { setStatusFilter('BLOCKED'); setPage(1) }} />
        <StatCard icon={<AlertTriangle className="h-5 w-5 text-amber-600" />} label="Alto Riesgo" value={stats.high_risk} color="bg-amber-50 border-amber-100" onClick={() => { setRiskFilter('HIGH'); setPage(1) }} />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-64 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, cédula, código, teléfono..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Todos los estados</option>
            <option value="ACTIVE">Activo</option>
            <option value="INACTIVE">Inactivo</option>
            <option value="BLOCKED">Bloqueado</option>
          </select>
          <select
            value={riskFilter}
            onChange={e => { setRiskFilter(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Todos los riesgos</option>
            <option value="LOW">Riesgo Bajo</option>
            <option value="MEDIUM">Riesgo Medio</option>
            <option value="HIGH">Riesgo Alto</option>
          </select>
          <button onClick={load} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <RefreshCw className="h-4 w-4 text-gray-500" />
          </button>
          <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors" title="Exportar">
            <Download className="h-4 w-4 text-gray-500" />
          </button>
          {(statusFilter || riskFilter || search || dateRange) && (
            <button
              onClick={() => { setStatusFilter(''); setRiskFilter(''); setSearch(''); setDateRange(null); setPage(1) }}
              className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
            >
              <Filter className="h-3 w-3" />
              Limpiar filtros
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
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Users className="h-12 w-12 mb-3 opacity-30" />
            <p className="font-medium">No se encontraron clientes</p>
            <p className="text-sm mt-1">Intenta cambiar los filtros o registra un nuevo cliente</p>
            <button onClick={() => setShowForm(true)} className="mt-4 flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
              <Plus className="h-4 w-4" /> Registrar cliente
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Cliente</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Documento</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Contacto</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Riesgo</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Préstamos</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Saldo</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Score</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {customers.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigate(`/customers/${c.id}`)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center shrink-0 overflow-hidden">
                          {c.photo
                            ? <img src={c.photo} alt="" className="w-full h-full object-cover" />
                            : <span className="text-primary-700 font-semibold text-sm">{c.full_name?.charAt(0)?.toUpperCase()}</span>
                          }
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{c.full_name}</p>
                          <p className="text-xs text-gray-400">{c.customer_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <p className="text-xs text-gray-400">{c.id_type}</p>
                      <p className="font-mono text-xs">{c.id_number}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1 text-xs text-gray-600"><Phone className="h-3 w-3" />{c.phone1}</span>
                        {c.email && <span className="flex items-center gap-1 text-xs text-gray-400"><Mail className="h-3 w-3" />{c.email}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status]}`}>
                        {c.status_display}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RISK_COLORS[c.risk_level]}`}>
                        {RISK_LABELS[c.risk_level]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-medium text-gray-900">{c.active_loans_count}</p>
                      <p className="text-xs text-gray-400">{c.total_loans_count} total</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-medium text-gray-900">{fmt(c.outstanding_balance)}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.credit_score != null ? (
                        <ScoreBadge score={c.credit_score} />
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/customers/${c.id}`)}
                        className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600 transition-colors"
                        title="Ver expediente"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">Página {page} de {totalPages} · {totalCount} clientes</p>
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
        <CustomerFormModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); loadStats() }} />
      )}

      {showImport && (
        <ImportModal onClose={() => { setShowImport(false); load(); loadStats() }} />
      )}
    </div>
  )
}

// ── Modal de importación ───────────────────────────────────────────────────────
function ImportModal({ onClose }: { onClose: () => void }) {
  const [file, setFile]         = useState<File | null>(null)
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<{ created: number; skipped: number; errors: string[]; message: string } | null>(null)

  const handleImport = async () => {
    if (!file) { toast.error('Selecciona un archivo .xlsx'); return }
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const token = (await import('@/store/slices/authStore')).useAuthStore.getState().accessToken
      const res = await fetch('/api/v1/reports/import/customers/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error importando')
      setResult(data)
      toast.success(data.message, { icon: '📊' })
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Error importando clientes')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <Upload className="h-5 w-5 text-emerald-600" />
            Importar Clientes desde Excel
          </h2>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          {!result ? (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                <p className="font-semibold mb-1">Instrucciones:</p>
                <ol className="list-decimal ml-4 space-y-0.5">
                  <li>Descarga la <strong>Plantilla Importar</strong> desde el botón en la lista de clientes</li>
                  <li>Llena los datos en la hoja "Clientes"</li>
                  <li>Sube el archivo aquí</li>
                </ol>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Archivo Excel (.xlsx)</label>
                <input type="file" accept=".xlsx"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div className="flex gap-3">
                <button onClick={handleImport} disabled={!file || loading}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60">
                  {loading ? 'Importando...' : 'Importar Clientes'}
                </button>
                <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50">Cancelar</button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <CheckCircle className="h-8 w-8 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold text-emerald-800">{result.message}</p>
                  <p className="text-sm text-emerald-600">{result.created} creados · {result.skipped} omitidos</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 max-h-40 overflow-y-auto">
                  <p className="text-xs font-bold text-red-700 mb-2">Errores ({result.errors.length}):</p>
                  {result.errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
                </div>
              )}
              <button onClick={onClose} className="w-full py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700">
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color, onClick }: {
  icon: React.ReactNode; label: string; value: number; color: string; onClick: () => void
}) {
  return (
    <button onClick={onClick} className={`flex items-center gap-3 p-4 rounded-xl border ${color} hover:shadow-sm transition-all text-left w-full`}>
      <div className="p-2 bg-white rounded-lg shadow-sm">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </button>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 750 ? 'text-emerald-600' : score >= 500 ? 'text-amber-600' : 'text-red-600'
  const barColor = score >= 750 ? 'bg-emerald-400' : score >= 500 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex flex-col items-center">
      <span className={`font-bold text-sm ${color}`}>{score}</span>
      <div className="w-12 h-1 bg-gray-100 rounded-full mt-0.5 overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, (score / 1000) * 100)}%` }} />
      </div>
    </div>
  )
}
