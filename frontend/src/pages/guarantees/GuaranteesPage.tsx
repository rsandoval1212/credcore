import { useState, useEffect, useCallback } from 'react'
import { Shield, Search, RefreshCw, ChevronLeft, ChevronRight, Car, Home, Wrench } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'

interface Guarantee {
  id: string; guarantee_type: string; guarantee_type_display: string
  loan_number: string; customer_name: string; description: string
  estimated_value: number; status: string; status_display: string
  appraisal_date: string; appraiser: string
  vehicle?: { make: string; model: string; year: number; plate_number: string }
  real_estate?: { property_type_display: string; address: string; city: string }
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  VEHICLE:     <Car className="h-4 w-4 text-blue-500" />,
  REAL_ESTATE: <Home className="h-4 w-4 text-emerald-500" />,
  EQUIPMENT:   <Wrench className="h-4 w-4 text-amber-500" />,
}
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700', RELEASED: 'bg-gray-100 text-gray-600', FORECLOSED: 'bg-red-100 text-red-700',
}
const fmt = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n)

export default function GuaranteesPage() {
  const [guarantees, setGuarantees] = useState<Guarantee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page }
      if (search) params.search = search
      if (typeFilter) params.guarantee_type = typeFilter
      if (statusFilter) params.status = statusFilter
      const r = await api.get('/guarantees/', { params })
      setGuarantees(r.data.results); setTotalPages(r.data.total_pages || 1); setTotalCount(r.data.count || 0)
    } catch { toast.error('Error cargando garantías') } finally { setLoading(false) }
  }, [page, search, typeFilter, statusFilter])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Garantías</h1><p className="text-sm text-gray-500 mt-1">{totalCount} garantías registradas</p></div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-52 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input placeholder="Buscar préstamo, cliente..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">Todos los tipos</option>
          <option value="VEHICLE">Vehículo</option>
          <option value="REAL_ESTATE">Inmueble</option>
          <option value="EQUIPMENT">Equipo</option>
          <option value="OTHER">Otro</option>
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">Todos los estados</option>
          <option value="ACTIVE">Activa</option>
          <option value="RELEASED">Liberada</option>
          <option value="FORECLOSED">Ejecutada</option>
        </select>
        <button onClick={load} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50"><RefreshCw className="h-4 w-4 text-gray-500" /></button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20"><RefreshCw className="h-6 w-6 text-primary-500 animate-spin" /></div>
        ) : guarantees.length === 0 ? (
          <div className="text-center py-20 text-gray-400"><Shield className="h-12 w-12 mx-auto mb-3 opacity-30" /><p className="font-medium">No hay garantías registradas</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-gray-100">
                {['Tipo', 'Préstamo', 'Cliente', 'Descripción', 'Valor estimado', 'Estado', 'Tasador'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {guarantees.map(g => (
                  <tr key={g.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        {TYPE_ICONS[g.guarantee_type] || <Shield className="h-4 w-4 text-gray-400" />}
                        <span className="text-xs font-medium text-gray-700">{g.guarantee_type_display}</span>
                      </span>
                      {g.vehicle && <p className="text-xs text-gray-400 mt-0.5">{g.vehicle.year} {g.vehicle.make} {g.vehicle.model} · {g.vehicle.plate_number}</p>}
                      {g.real_estate && <p className="text-xs text-gray-400 mt-0.5">{g.real_estate.property_type_display} · {g.real_estate.city}</p>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{g.loan_number}</td>
                    <td className="px-4 py-3 text-gray-700">{g.customer_name}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs max-w-xs truncate">{g.description}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{fmt(g.estimated_value)}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[g.status] || 'bg-gray-100 text-gray-600'}`}>{g.status_display}</span></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{g.appraiser || '—'}</td>
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
    </div>
  )
}
