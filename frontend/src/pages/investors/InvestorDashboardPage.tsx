import { useState, useEffect } from 'react'
import {
  TrendingUp, DollarSign, Users, CreditCard, AlertTriangle,
  BarChart3, RefreshCw, Building2, Shield, Percent, Coins,
  Target, PieChart,
} from 'lucide-react'
import api from '@/services/api'
import ExportButton from '@/components/ui/ExportButton'

const fmt = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n)
const pct = (n: number) => `${n.toFixed(2)}%`

interface InvestorData {
  kpis: Record<string, number>
  branches: { id: number; name: string; active_loans: number; portfolio: number; month_interest: number; month_collected: number; overdue_amount: number; delinquency: number }[]
  license: { plan: string; expires: string | null; max_branches: number; max_users: number; current_branches: number; current_users: number }
  exchange_rate: { primary: string; secondary: string | null; rate: number }
}

function KPI({ label, value, sublabel, icon: Icon, color }: { label: string; value: string; sublabel?: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <p className={`text-xl font-black mt-1 ${color}`}>{value}</p>
          {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
        </div>
        <div className="p-2 bg-gray-50 rounded-lg"><Icon className="h-5 w-5 text-gray-400" /></div>
      </div>
    </div>
  )
}

export default function InvestorDashboardPage() {
  const [data, setData]       = useState<InvestorData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const r = await api.get('/dashboard/investors/')
      setData(r.data)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="h-6 w-6 text-primary-500 animate-spin" />
    </div>
  )

  if (!data) return <div className="p-6 text-center text-gray-400">Sin datos disponibles</div>

  const k = data.kpis

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
            <PieChart className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Panel de Inversionistas</h1>
            <p className="text-xs text-gray-400">Resumen ejecutivo de rentabilidad y portafolio</p>
          </div>
        </div>
        <div className="flex gap-2">
          <ExportButton endpoint="/api/v1/reports/export/master/" label="Reporte Excel" variant="default" />
          <button onClick={load} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
            <RefreshCw className="h-4 w-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Capital Invertido Total" value={fmt(k.total_capital_invested)} icon={DollarSign} color="text-blue-700" sublabel="Desde el inicio" />
        <KPI label="Ganancia Cobrada" value={fmt(k.total_interest_earned)} icon={Coins} color="text-emerald-700" sublabel={`ROI total: ${pct(k.roi_total_pct)}`} />
        <KPI label="Ganancia Por Cobrar" value={fmt(k.expected_interest_pending)} icon={TrendingUp} color="text-amber-700" sublabel="Intereses pendientes en activos" />
        <KPI label="Ganancia Total Esperada" value={fmt(k.expected_total_profit)} icon={Target} color="text-purple-700" sublabel="Cobrada + por cobrar" />
      </div>

      {/* KPIs secundarios */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="ROI del Año" value={pct(k.roi_year_pct)} icon={TrendingUp} color="text-purple-700" sublabel={`Intereses: ${fmt(k.year_interest)}`} />
        <KPI label="Tasa de Morosidad" value={pct(k.delinquency_pct)} icon={AlertTriangle} color={k.delinquency_pct > 10 ? 'text-red-700' : 'text-emerald-700'} sublabel={`Mora: ${fmt(k.overdue_amount)}`} />
        <KPI label="Cobros del Mes" value={fmt(k.month_collected)} icon={BarChart3} color="text-indigo-700" sublabel={`Intereses: ${fmt(k.month_interest)}`} />
        <KPI label="Proyección Mensual" value={fmt(k.avg_monthly_projection)} icon={Percent} color="text-amber-700" sublabel="Promedio últimos 3 meses" />
      </div>

      {/* Tercera fila — portafolio */}
      <div className="grid grid-cols-2 lg:grid-cols-2 gap-4">
        <KPI label="Portafolio Activo" value={fmt(k.total_portfolio)} icon={CreditCard} color="text-gray-900" sublabel={`${k.active_loans} préstamos`} />
        <KPI label="Total Recuperado" value={fmt(k.total_collected)} icon={Target} color="text-blue-600" sublabel={`Capital: ${fmt(k.total_principal_recovered)}`} />
      </div>

      {/* Resumen de ganancia recuperada */}
      <div className="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-2xl border border-emerald-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Coins className="h-5 w-5 text-emerald-700" />
          <h2 className="font-bold text-gray-900 text-sm">Ganancia recuperada (lo cobrado hasta ahora)</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-emerald-100">
            <p className="text-xs text-gray-500 mb-1">Hoy</p>
            <p className="text-lg font-bold text-emerald-700">{fmt(k.today_interest || 0)}</p>
            <p className="text-xs text-gray-400 mt-1">Capital: {fmt(k.today_principal_recovered || 0)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-emerald-100">
            <p className="text-xs text-gray-500 mb-1">Este mes</p>
            <p className="text-lg font-bold text-emerald-700">{fmt(k.month_interest)}</p>
            <p className="text-xs text-gray-400 mt-1">Cobrado: {fmt(k.month_collected)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-emerald-100">
            <p className="text-xs text-gray-500 mb-1">Este año</p>
            <p className="text-lg font-bold text-emerald-700">{fmt(k.year_interest)}</p>
            <p className="text-xs text-gray-400 mt-1">Cobrado: {fmt(k.year_collected)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-emerald-200">
            <p className="text-xs text-gray-500 mb-1">Total histórico</p>
            <p className="text-lg font-bold text-emerald-800">{fmt(k.total_interest_earned)}</p>
            <p className="text-xs text-gray-400 mt-1">ROI: {pct(k.roi_total_pct)}</p>
          </div>
        </div>
      </div>

      {/* Rendimiento por sucursal */}
      {data.branches.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-gray-400" />
            <h2 className="font-bold text-gray-900 text-sm">Rendimiento por Sucursal</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Sucursal', 'Préstamos', 'Portafolio', 'Cobros Mes', 'Intereses Mes', 'Mora', '% Morosidad'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-gray-500 text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.branches.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900">{b.name}</td>
                    <td className="px-4 py-3 text-center">{b.active_loans}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmt(b.portfolio)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-medium">{fmt(b.month_collected)}</td>
                    <td className="px-4 py-3 text-right text-purple-600 font-medium">{fmt(b.month_interest)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{fmt(b.overdue_amount)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        b.delinquency > 15 ? 'bg-red-100 text-red-700' :
                        b.delinquency > 5  ? 'bg-amber-100 text-amber-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>{pct(b.delinquency)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Licencia + Moneda */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Licencia */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-violet-500" />
            <h3 className="font-bold text-gray-900 text-sm">Licencia del Sistema</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-gray-400">Plan</p><p className="font-bold text-gray-900">{data.license.plan}</p></div>
            <div><p className="text-xs text-gray-400">Expira</p><p className="font-medium">{data.license.expires || 'Sin fecha'}</p></div>
            <div><p className="text-xs text-gray-400">Sucursales</p><p className="font-medium">{data.license.current_branches} / {data.license.max_branches}</p></div>
            <div><p className="text-xs text-gray-400">Usuarios</p><p className="font-medium">{data.license.current_users} / {data.license.max_users}</p></div>
          </div>
        </div>

        {/* Multi-moneda */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="h-5 w-5 text-green-500" />
            <h3 className="font-bold text-gray-900 text-sm">Configuración Monetaria</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-gray-400">Moneda principal</p><p className="font-bold text-gray-900">{data.exchange_rate.primary}</p></div>
            <div><p className="text-xs text-gray-400">Moneda secundaria</p><p className="font-medium">{data.exchange_rate.secondary || '—'}</p></div>
            <div className="col-span-2"><p className="text-xs text-gray-400">Tasa de cambio</p>
              <p className="font-bold text-lg text-blue-700">
                {data.exchange_rate.rate > 0 ? `1 USD = ${data.exchange_rate.rate.toFixed(2)} DOP` : 'No configurada'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Clientes activos */}
      <div className="bg-gray-50 rounded-xl p-4 text-center text-sm text-gray-500">
        <Users className="h-5 w-5 inline-block mr-1 text-gray-400" />
        <strong className="text-gray-900">{k.active_customers}</strong> clientes activos · <strong className="text-gray-900">{k.active_loans}</strong> préstamos vigentes
      </div>
    </div>
  )
}
