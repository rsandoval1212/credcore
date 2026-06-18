import { useQuery } from '@tanstack/react-query'
import { dashboardService } from '@/services/dashboard'
import { formatCurrency } from '@/utils/format'
import {
  Users, AlertTriangle, DollarSign, CreditCard,
  TrendingUp, TrendingDown, Calendar, Coins,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, sublabel, icon: Icon, color, textColor }: {
  label: string; value: string; sublabel?: string
  icon: React.ElementType; color: string; textColor?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] sm:text-xs font-medium text-gray-500 truncate">{label}</p>
          <p
            className={`text-base sm:text-xl font-black mt-1 truncate ${textColor || 'text-gray-900'}`}
            title={value}
          >
            {value}
          </p>
          {sublabel && <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 truncate">{sublabel}</p>}
        </div>
        <div className={`p-2 sm:p-2.5 rounded-xl ${color} shrink-0`}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
        </div>
      </div>
    </div>
  )
}

// ─── Semáforo de mora ─────────────────────────────────────────────────────────
function MoraSemaforo({ data }: { data: { mora_1_15: number; mora_16_30: number; mora_30_plus: number } }) {
  const items = [
    { emoji: '🟢', label: 'Al día',    count: 0,              color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
    { emoji: '🟡', label: '1-15 días', count: data.mora_1_15,  color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
    { emoji: '🟠', label: '16-30 días',count: data.mora_16_30, color: 'bg-orange-50 border-orange-200 text-orange-700' },
    { emoji: '🔴', label: '+30 días',  count: data.mora_30_plus, color: 'bg-red-50 border-red-200 text-red-700' },
  ]
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Semáforo de Mora</h3>
      <div className="grid grid-cols-2 gap-2">
        {items.map(it => (
          <div key={it.label} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${it.color}`}>
            <span className="text-sm">{it.emoji} {it.label}</span>
            <span className="font-black text-lg">{it.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardService.getData().then(r => r.data),
    refetchInterval: 60_000,
  })

  const { data: charts } = useQuery({
    queryKey: ['dashboard-charts'],
    queryFn: () => dashboardService.getCharts().then(r => r.data),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  type D = import('@/types').DashboardData
  const d: Partial<D> = data ?? {}
  const todayLabel = d.today
    ? new Date(d.today + 'T12:00:00').toLocaleDateString('es-DO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Título */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-xs sm:text-sm capitalize">{todayLabel}</p>
      </div>

      {/* KPIs principales — fila 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KPICard
          label="Cartera Activa"
          value={formatCurrency(d.total_portfolio || 0)}
          sublabel={`${d.active_loans_count || 0} préstamos activos`}
          icon={CreditCard}
          color="bg-primary-600"
        />
        <KPICard
          label="Intereses del Mes"
          value={formatCurrency(d.interest_this_month || 0)}
          sublabel="Ganancia bruta mensual"
          icon={Coins}
          color="bg-emerald-600"
          textColor="text-emerald-700"
        />
        <KPICard
          label="Cobros del Día"
          value={formatCurrency(d.collections_today || 0)}
          sublabel={`${d.collections_today_count || 0} transacciones hoy`}
          icon={DollarSign}
          color="bg-blue-600"
          textColor="text-blue-700"
        />
        <KPICard
          label="Cobros del Mes"
          value={formatCurrency(d.collections_this_month || 0)}
          sublabel={`${d.collections_month_count || 0} transacciones`}
          icon={TrendingUp}
          color="bg-violet-600"
        />
      </div>

      {/* KPIs secundarios — fila 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KPICard
          label="Cartera en Mora"
          value={formatCurrency(d.overdue_portfolio || 0)}
          sublabel={`Tasa morosidad: ${(d.delinquency_rate || 0).toFixed(2)}%`}
          icon={AlertTriangle}
          color="bg-red-500"
          textColor="text-red-700"
        />
        <KPICard
          label="Clientes Activos"
          value={String(d.active_customers || 0)}
          sublabel={`${d.customers_in_arrears || 0} en atraso`}
          icon={Users}
          color="bg-purple-600"
        />
        <KPICard
          label="Préstamos en Mora"
          value={String(d.overdue_loans_count || 0)}
          sublabel={`de ${d.active_loans_count || 0} activos`}
          icon={TrendingDown}
          color="bg-orange-500"
          textColor="text-orange-700"
        />
        <KPICard
          label="Próx. Vencimientos"
          value={String(d.upcoming_payments || 0)}
          sublabel="Próximos 7 días"
          icon={Calendar}
          color="bg-amber-500"
          textColor="text-amber-700"
        />
      </div>

      {/* Semáforo + Gráfico */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Semáforo de mora */}
        <MoraSemaforo data={{
          mora_1_15:   d.mora_1_15   || 0,
          mora_16_30:  d.mora_16_30  || 0,
          mora_30_plus:d.mora_30_plus || 0,
        }} />

        {/* Gráfico cobros por mes */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Cobros por Mes</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={charts?.collections_by_month?.slice().reverse() || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis
                dataKey="month"
                tickFormatter={v => v ? new Date(v).toLocaleDateString('es-DO', { month: 'short' }) : ''}
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tickFormatter={v => `${(v / 1000).toFixed(0)}K`}
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                axisLine={false} tickLine={false}
              />
              <Tooltip
                formatter={(v: number) => [formatCurrency(v), 'Cobros']}
                contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
              />
              <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Resumen ejecutivo del mes */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Resumen del Mes</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {[
            { label: 'Desembolsos', value: formatCurrency(d.disbursements_this_month || 0), color: 'text-blue-600' },
            { label: 'Cobros totales', value: formatCurrency(d.collections_this_month || 0), color: 'text-emerald-600' },
            { label: 'Intereses (ganancia)', value: formatCurrency(d.interest_this_month || 0), color: 'text-purple-600' },
            { label: 'Intereses hoy', value: formatCurrency(d.interest_today || 0), color: 'text-indigo-600' },
            { label: 'P. en mora', value: String(d.overdue_loans_count || 0), color: 'text-red-600' },
            { label: 'Tasa morosidad', value: `${(d.delinquency_rate || 0).toFixed(2)}%`, color: (d.delinquency_rate || 0) > 10 ? 'text-red-600' : 'text-emerald-600' },
          ].map(item => (
            <div key={item.label} className="text-center py-2 sm:py-3 px-1 bg-gray-50 lg:bg-transparent rounded-lg lg:rounded-none lg:border-r lg:border-gray-100 lg:last:border-0">
              <p className={`text-sm sm:text-lg font-black truncate ${item.color}`} title={item.value}>{item.value}</p>
              <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 truncate">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
