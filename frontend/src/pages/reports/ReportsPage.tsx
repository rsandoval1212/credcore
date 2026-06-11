import { useState, useEffect, useCallback } from 'react'
import {
  BarChart3, TrendingUp, Users, CreditCard, DollarSign,
  AlertTriangle, CheckCircle, RefreshCw, Printer,
  TrendingDown, Calendar, Percent, Coins, ArrowLeftRight,
} from 'lucide-react'
import api from '@/services/api'
import ExportButton from '@/components/ui/ExportButton'
import { earningsService, type EarningsData, type EarningsPeriod } from '@/services/company'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface DashData { total_portfolio?: number; active_loans_count?: number; overdue_loans_count?: number; overdue_portfolio?: number; delinquency_rate?: number; active_customers?: number; customers_in_arrears?: number; collections_this_month?: number; disbursements_this_month?: number }
interface LoanStats { total?: number; active?: number; completed?: number; defaulted?: number; written_off?: number; total_portfolio?: number; total_disbursed?: number; total_collected?: number; overdue_count?: number; overdue_portfolio?: number; avg_days_past_due?: number; delinquency_rate?: number }
interface PayStats { total?: number; today_count?: number; today_amount?: number; month_count?: number; month_amount?: number; confirmed_total?: number; cash_amount?: number; transfer_amount?: number }

// ─── Formateo ─────────────────────────────────────────────────────────────────
const fmt = (n?: number | null) => n == null ? 'RD$0' : new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n)
const pct = (n?: number | null) => n == null ? '0%' : `${Number(n).toFixed(2)}%`
const num = (n?: number | null) => n == null ? '0' : new Intl.NumberFormat('es-DO').format(Number(n))

// ─── KPI Card ──────────────────────────────────────────────────────────────────
function ReportCard({ label, value, sub, color, icon }: { label: string; value: string; sub?: string; color: string; icon: React.ReactNode }) {
  const c: Record<string, string> = { blue: 'bg-blue-50 border-blue-100', emerald: 'bg-emerald-50 border-emerald-100', red: 'bg-red-50 border-red-100', amber: 'bg-amber-50 border-amber-100', purple: 'bg-purple-50 border-purple-100', green: 'bg-green-50 border-green-100' }
  return (
    <div className={`rounded-xl border p-4 ${c[color] || 'bg-gray-50 border-gray-100'}`}>
      <div className="flex items-center gap-2 mb-2 text-gray-500">{icon}<p className="text-xs font-medium">{label}</p></div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Mini gráfica de barras ────────────────────────────────────────────────────
function BarChart({ data, valueKey, color, height = 80 }: { data: EarningsPeriod[]; valueKey: 'interest' | 'total'; color: string; height?: number }) {
  if (!data.length) return null
  const max = Math.max(...data.map(d => d[valueKey]), 1)
  return (
    <div className="flex items-end gap-0.5" style={{ height }}>
      {data.map((d, i) => {
        const h = Math.max(2, (d[valueKey] / max) * height)
        return (
          <div key={i} className="flex-1 group relative cursor-default">
            <div
              className={`w-full rounded-sm transition-all ${color} opacity-80 group-hover:opacity-100`}
              style={{ height: h }}
            />
            {d[valueKey] > 0 && (
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded px-1.5 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                {d.label}: {fmt(d[valueKey])}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Tab Ingresos ─────────────────────────────────────────────────────────────
function EarningsTab() {
  const [data, setData] = useState<EarningsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'daily' | 'weekly' | 'monthly'>('daily')

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await earningsService.get(); setData(r.data) }
    catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex justify-center py-20"><RefreshCw className="h-6 w-6 text-primary-500 animate-spin" /></div>
  if (!data) return <div className="text-center py-20 text-gray-400">Sin datos de ingresos</div>

  const s = data.summary
  const periods = data[view]
  const totalInterest = periods.reduce((acc, d) => acc + d.interest, 0)
  const totalRevenue  = periods.reduce((acc, d) => acc + d.total, 0)
  const maxDay = [...data.daily].sort((a, b) => b.interest - a.interest)[0]

  return (
    <div className="space-y-6">
      {/* Resumen rápido */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportCard label="Intereses Hoy"        value={fmt(s.today_interest)}  sub={`Total cobrado: ${fmt(s.today_total)}`}    color="emerald" icon={<Coins className="h-5 w-5 text-emerald-600" />} />
        <ReportCard label="Intereses esta Semana" value={fmt(s.week_interest)}   sub={`Total cobrado: ${fmt(s.week_total)}`}    color="blue"    icon={<TrendingUp className="h-5 w-5 text-blue-600" />} />
        <ReportCard label="Intereses este Mes"    value={fmt(s.month_interest)}  sub={`Total cobrado: ${fmt(s.month_total)}`}   color="purple"  icon={<Calendar className="h-5 w-5 text-purple-600" />} />
        <ReportCard label="Intereses este Año"    value={fmt(s.year_interest)}   sub={`Total cobrado: ${fmt(s.year_total)}`}    color="amber"   icon={<BarChart3 className="h-5 w-5 text-amber-600" />} />
      </div>

      {/* Dato destacado */}
      {maxDay && maxDay.interest > 0 && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold text-emerald-600 uppercase">Mejor día (últimos 30 días)</p>
            <p className="text-lg font-black text-gray-900">{fmt(maxDay.interest)} en intereses</p>
            <p className="text-xs text-gray-500">{maxDay.label} · {maxDay.count} pago{maxDay.count !== 1 ? 's' : ''} · Total cobrado {fmt(maxDay.total)}</p>
          </div>
        </div>
      )}

      {/* Selector de período */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-purple-500" />
            Ingresos por Intereses
            <span className="ml-2 text-xs font-normal text-gray-400">
              Total período: {fmt(totalInterest)} | Cobrado: {fmt(totalRevenue)}
            </span>
          </h3>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {([['daily', 'Diario'], ['weekly', 'Semanal'], ['monthly', 'Mensual']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setView(k)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === k ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Gráfica de barras */}
        <div className="p-5">
          <BarChart data={periods} valueKey="interest" color="bg-purple-400" height={100} />
          {/* Etiquetas del eje X (solo algunas) */}
          <div className="flex mt-1">
            {periods.map((d, i) => {
              const step = view === 'daily' ? 4 : 1
              return (
                <div key={i} className="flex-1 text-center">
                  {i % step === 0 && <span className="text-[9px] text-gray-400">{d.label}</span>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Tabla detallada */}
        <div className="border-t border-gray-100 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Período</th>
                <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Intereses</th>
                <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Capital</th>
                <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Total cobrado</th>
                <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Pagos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[...periods].reverse().map((d, i) => (
                <tr key={i} className={`hover:bg-purple-50/30 ${d.interest > 0 ? '' : 'opacity-40'}`}>
                  <td className="px-4 py-2.5 font-medium text-gray-700">{d.label}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-purple-700">{d.interest > 0 ? fmt(d.interest) : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{d.principal > 0 ? fmt(d.principal) : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-gray-900 font-semibold">{d.total > 0 ? fmt(d.total) : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-gray-400">{d.count || '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-purple-50 border-t-2 border-purple-200">
                <td className="px-4 py-2.5 font-black text-purple-700 text-xs uppercase">Total</td>
                <td className="px-4 py-2.5 text-right font-black text-purple-700">{fmt(totalInterest)}</td>
                <td className="px-4 py-2.5 text-right font-black text-gray-700">{fmt(periods.reduce((a, d) => a + d.principal, 0))}</td>
                <td className="px-4 py-2.5 text-right font-black text-gray-900">{fmt(totalRevenue)}</td>
                <td className="px-4 py-2.5 text-right font-black text-gray-500">{periods.reduce((a, d) => a + d.count, 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Tab Cambio USD ──────────────────────────────────────────────────────────
interface ExchangeStats {
  today_buy_count: number; today_buy_usd: number; today_buy_dop: number
  today_sell_count: number; today_sell_usd: number; today_sell_dop: number
  today_profit: number; month_profit: number; month_count: number
  month_buy_usd: number; month_sell_usd: number
  current_buy_rate: number; current_sell_rate: number; current_spread: number
  total_profit: number; total_transactions: number
}

interface ExchangeTxn {
  id: string; receipt_number: string; operation: string; operation_display: string
  status: string; status_display: string; rate_applied: number
  usd_amount: number; dop_amount: number; profit: number
  customer_display: string; payment_method_display: string
  created_at: string
}

const fmtUSD = (n?: number | null) =>
  n == null ? 'US$0.00' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
const fmtRate = (n?: number | null) => n == null ? '0.0000' : Number(n).toFixed(4)
const fmtDt = (d?: string) =>
  !d ? '—' : new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

function ExchangeTab() {
  const [stats, setStats] = useState<ExchangeStats | null>(null)
  const [txns, setTxns] = useState<ExchangeTxn[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, t] = await Promise.all([
        api.get('/currency-exchange/transactions/stats/'),
        api.get('/currency-exchange/transactions/', { params: { ordering: '-created_at', page_size: 50 } }),
      ])
      setStats(s.data)
      setTxns(t.data.results || t.data)
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex justify-center py-20"><RefreshCw className="h-6 w-6 text-primary-500 animate-spin" /></div>
  if (!stats) return <div className="text-center py-20 text-gray-400">Sin datos de cambio de divisas</div>

  const todayTotal = stats.today_buy_usd + stats.today_sell_usd
  const todayOps = stats.today_buy_count + stats.today_sell_count
  const monthTotal = stats.month_buy_usd + stats.month_sell_usd

  return (
    <div className="space-y-6">
      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportCard label="Ganancia Hoy" value={fmt(stats.today_profit)} sub={`${todayOps} operaciones`} color="emerald" icon={<DollarSign className="h-5 w-5 text-emerald-600" />} />
        <ReportCard label="Ganancia del Mes" value={fmt(stats.month_profit)} sub={`${num(stats.month_count)} operaciones`} color="blue" icon={<TrendingUp className="h-5 w-5 text-blue-600" />} />
        <ReportCard label="Ganancia Total" value={fmt(stats.total_profit)} sub={`${num(stats.total_transactions)} operaciones históricas`} color="purple" icon={<Coins className="h-5 w-5 text-purple-600" />} />
        <ReportCard label="Spread Actual" value={fmtRate(stats.current_spread)} sub={`Compra: ${fmtRate(stats.current_buy_rate)} · Venta: ${fmtRate(stats.current_sell_rate)}`} color="amber" icon={<ArrowLeftRight className="h-5 w-5 text-amber-600" />} />
      </div>

      {/* Compras vs Ventas - Hoy y Mes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hoy */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-bold text-gray-700 mb-4 text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" /> Operaciones de Hoy
          </h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <div className="text-xs text-blue-600 font-semibold mb-1 flex items-center justify-center gap-1">
                <TrendingDown className="h-3 w-3" /> Compras USD
              </div>
              <div className="text-2xl font-black text-gray-900">{fmtUSD(stats.today_buy_usd)}</div>
              <div className="text-xs text-gray-400 mt-1">{stats.today_buy_count} operaciones</div>
              <div className="text-xs text-gray-500 mt-0.5">Pagado: {fmt(stats.today_buy_dop)}</div>
            </div>
            <div className="bg-red-50 rounded-xl p-4 text-center">
              <div className="text-xs text-red-600 font-semibold mb-1 flex items-center justify-center gap-1">
                <TrendingUp className="h-3 w-3" /> Ventas USD
              </div>
              <div className="text-2xl font-black text-gray-900">{fmtUSD(stats.today_sell_usd)}</div>
              <div className="text-xs text-gray-400 mt-1">{stats.today_sell_count} operaciones</div>
              <div className="text-xs text-gray-500 mt-0.5">Recibido: {fmt(stats.today_sell_dop)}</div>
            </div>
          </div>
          <div className="flex justify-between items-center py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">Volumen total hoy</span>
            <span className="text-sm font-bold text-gray-900">{fmtUSD(todayTotal)}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500 font-semibold">Ganancia neta hoy</span>
            <span className="text-sm font-black text-emerald-600">{fmt(stats.today_profit)}</span>
          </div>
        </div>

        {/* Mes */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-bold text-gray-700 mb-4 text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-purple-500" /> Resumen del Mes
          </h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <div className="text-xs text-blue-600 font-semibold mb-1">Compras USD (Mes)</div>
              <div className="text-2xl font-black text-gray-900">{fmtUSD(stats.month_buy_usd)}</div>
            </div>
            <div className="bg-red-50 rounded-xl p-4 text-center">
              <div className="text-xs text-red-600 font-semibold mb-1">Ventas USD (Mes)</div>
              <div className="text-2xl font-black text-gray-900">{fmtUSD(stats.month_sell_usd)}</div>
            </div>
          </div>
          <div className="flex justify-between items-center py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">Volumen total mes</span>
            <span className="text-sm font-bold text-gray-900">{fmtUSD(monthTotal)}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">Total operaciones</span>
            <span className="text-sm font-bold text-gray-900">{num(stats.month_count)}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500 font-semibold">Ganancia neta del mes</span>
            <span className="text-sm font-black text-emerald-600">{fmt(stats.month_profit)}</span>
          </div>
        </div>
      </div>

      {/* Resumen acumulado */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h3 className="font-bold text-gray-700 mb-4 text-sm flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-green-500" /> Resumen Acumulado
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-xl">
            <div className="text-xs text-gray-500 mb-1">Total Operaciones</div>
            <div className="text-2xl font-black text-gray-900">{num(stats.total_transactions)}</div>
          </div>
          <div className="text-center p-4 bg-emerald-50 rounded-xl">
            <div className="text-xs text-emerald-600 mb-1">Ganancia Acumulada</div>
            <div className="text-2xl font-black text-emerald-700">{fmt(stats.total_profit)}</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-xl">
            <div className="text-xs text-blue-600 mb-1">Tasa Compra</div>
            <div className="text-2xl font-black text-blue-700">{fmtRate(stats.current_buy_rate)}</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-xl">
            <div className="text-xs text-red-600 mb-1">Tasa Venta</div>
            <div className="text-2xl font-black text-red-700">{fmtRate(stats.current_sell_rate)}</div>
          </div>
        </div>
      </div>

      {/* Últimas operaciones */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-500" /> Últimas Operaciones de Cambio
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3">Recibo</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3 text-right">USD</th>
                <th className="px-4 py-3 text-right">Tasa</th>
                <th className="px-4 py-3 text-right">DOP</th>
                <th className="px-4 py-3 text-right">Ganancia</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {txns.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">No hay operaciones registradas</td></tr>
              ) : txns.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{t.receipt_number}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDt(t.created_at)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${t.operation === 'BUY' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                      {t.operation === 'BUY' ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                      {t.operation_display}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-[140px] truncate">{t.customer_display}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmtUSD(t.usd_amount)}</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500">{fmtRate(t.rate_applied)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmt(t.dop_amount)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600">{fmt(t.profit)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      t.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                      t.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>{t.status_display}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
const TABS = [
  { id: 'portafolio', label: 'Portafolio', icon: CreditCard },
  { id: 'ingresos',  label: 'Ingresos',   icon: Coins },
  { id: 'cambio',    label: 'Cambio USD',  icon: ArrowLeftRight },
]

export default function ReportsPage() {
  const [tab, setTab]             = useState<'portafolio' | 'ingresos' | 'cambio'>('portafolio')
  const [dash, setDash]           = useState<DashData | null>(null)
  const [loanStats, setLoanStats] = useState<LoanStats | null>(null)
  const [payStats, setPayStats]   = useState<PayStats | null>(null)
  const [loading, setLoading]     = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [d, ls, ps] = await Promise.all([
        api.get('/dashboard/').catch(() => ({ data: {} })),
        api.get('/loans/stats/').catch(() => ({ data: {} })),
        api.get('/payments/stats/').catch(() => ({ data: {} })),
      ])
      setDash(d.data); setLoanStats(ls.data); setPayStats(ps.data)
      setLastUpdate(new Date())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const activeLoans      = loanStats?.active || 1
  const overdueCount     = loanStats?.overdue_count || 0
  const delRate          = loanStats?.delinquency_rate ?? ((overdueCount / activeLoans) * 100)
  const portfolio        = loanStats?.total_portfolio || 0
  const overduePortfolio = loanStats?.overdue_portfolio || 0
  const coverageOk       = portfolio > 0 ? (1 - overduePortfolio / portfolio) * 100 : 100

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Reportes Ejecutivos</h1>
              <p className="text-xs text-gray-400">{lastUpdate ? `Actualizado: ${lastUpdate.toLocaleTimeString('es-DO')}` : 'Cargando...'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
              <RefreshCw className="h-4 w-4 text-gray-400" />
            </button>
            <ExportButton
              endpoint="/api/v1/reports/export/master/"
              label="Reporte Maestro Excel"
              variant="default"
            />
            <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700">
              <Printer className="h-4 w-4" />Imprimir
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 -mb-4 border-b border-transparent">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-violet-600 text-violet-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <Icon className="h-3.5 w-3.5" />{t.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* ── Tab Ingresos ────────────────────────────────────────────────── */}
        {tab === 'ingresos' && <EarningsTab />}

        {/* ── Tab Cambio USD ─────────────────────────────────────────────── */}
        {tab === 'cambio' && <ExchangeTab />}

        {/* ── Tab Portafolio ──────────────────────────────────────────────── */}
        {tab === 'portafolio' && (
          loading ? (
            <div className="flex justify-center py-20"><RefreshCw className="h-6 w-6 text-primary-500 animate-spin" /></div>
          ) : (
            <div className="space-y-8">
              {/* Portafolio */}
              <div>
                <h2 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2 mb-3"><CreditCard className="h-4 w-4" />Portafolio de Crédito</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <ReportCard label="Portafolio Activo"    value={fmt(loanStats?.total_portfolio)} sub={`${num(loanStats?.active)} préstamos activos`} color="blue"   icon={<TrendingUp className="h-5 w-5 text-blue-600" />} />
                  <ReportCard label="Total Desembolsado"   value={fmt(loanStats?.total_disbursed)} sub={`${num(loanStats?.total)} préstamos`}           color="emerald" icon={<DollarSign className="h-5 w-5 text-emerald-600" />} />
                  <ReportCard label="Cartera en Mora"      value={fmt(loanStats?.overdue_portfolio)} sub={`${num(overdueCount)} préstamos vencidos`}    color="red"    icon={<AlertTriangle className="h-5 w-5 text-red-600" />} />
                  <ReportCard label="Tasa de Morosidad"    value={pct(delRate)} sub={`Cobertura sana: ${coverageOk.toFixed(1)}%`}                        color="amber"  icon={<Percent className="h-5 w-5 text-amber-600" />} />
                </div>
              </div>

              {/* Cobros */}
              <div>
                <h2 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2 mb-3"><DollarSign className="h-4 w-4" />Cobros y Pagos</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <ReportCard label="Cobros Hoy"       value={fmt(payStats?.today_amount)}   sub={`${num(payStats?.today_count)} transacciones`}  color="blue"   icon={<Calendar className="h-5 w-5 text-blue-600" />} />
                  <ReportCard label="Cobros Este Mes"  value={fmt(payStats?.month_amount)}   sub={`${num(payStats?.month_count)} transacciones`}  color="emerald" icon={<CheckCircle className="h-5 w-5 text-emerald-600" />} />
                  <ReportCard label="En Efectivo"      value={fmt(payStats?.cash_amount)}    color="amber"  icon={<DollarSign className="h-5 w-5 text-amber-600" />} />
                  <ReportCard label="Transferencias"   value={fmt(payStats?.transfer_amount)} color="purple" icon={<TrendingUp className="h-5 w-5 text-purple-600" />} />
                </div>
              </div>

              {/* Clientes */}
              <div>
                <h2 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2 mb-3"><Users className="h-4 w-4" />Clientes</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <ReportCard label="Clientes Activos"      value={num(dash?.active_customers)}    color="emerald" icon={<Users className="h-5 w-5 text-emerald-600" />} />
                  <ReportCard label="En Atraso"             value={num(dash?.customers_in_arrears)} color="red"    icon={<AlertTriangle className="h-5 w-5 text-red-600" />} />
                  <ReportCard label="Préstamos Completados" value={num(loanStats?.completed)}       color="blue"   icon={<CheckCircle className="h-5 w-5 text-blue-600" />} />
                  <ReportCard label="Total Recuperado"      value={fmt(loanStats?.total_collected)} color="purple" icon={<TrendingDown className="h-5 w-5 text-purple-600" />} />
                </div>
              </div>

              {/* Tablas resumen */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <h3 className="font-bold text-gray-700 mb-4 text-sm flex items-center gap-2"><CreditCard className="h-4 w-4 text-blue-500" />Resumen de Préstamos</h3>
                  {[['Activos', num(loanStats?.active), 'text-emerald-600'], ['Completados', num(loanStats?.completed), 'text-blue-600'], ['En mora', num(loanStats?.defaulted), 'text-orange-600'], ['Castigados', num(loanStats?.written_off), 'text-red-600'], ['Días prom. mora', `${Number(loanStats?.avg_days_past_due || 0).toFixed(0)} días`, 'text-amber-600'], ['Portafolio total', fmt(loanStats?.total_portfolio), 'text-gray-900 font-bold']].map(([l, v, c]) => (
                    <div key={l} className="flex justify-between py-2 border-b border-gray-50 last:border-0 text-sm">
                      <span className="text-gray-500">{l}</span><span className={c}>{v}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <h3 className="font-bold text-gray-700 mb-4 text-sm flex items-center gap-2"><DollarSign className="h-4 w-4 text-emerald-500" />Resumen de Cobranza</h3>
                  {[['Desembolsado histórico', fmt(loanStats?.total_disbursed), 'text-gray-900'], ['Recuperado histórico', fmt(loanStats?.total_collected), 'text-emerald-600 font-bold'], ['Mora actual', fmt(loanStats?.overdue_portfolio), 'text-red-600'], ['Cobros del mes', fmt(dash?.collections_this_month), 'text-blue-600'], ['Desembolsos del mes', fmt(dash?.disbursements_this_month), 'text-purple-600'], ['Tasa de morosidad', pct(delRate), delRate > 10 ? 'text-red-600 font-bold' : 'text-emerald-600']].map(([l, v, c]) => (
                    <div key={l} className="flex justify-between py-2 border-b border-gray-50 last:border-0 text-sm">
                      <span className="text-gray-500">{l}</span><span className={c}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {portfolio > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <h3 className="font-bold text-gray-700 mb-4 text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-violet-500" />Distribución del Portafolio</h3>
                  <div className="h-6 bg-gray-100 rounded-full overflow-hidden flex mb-3">
                    <div className="h-full bg-emerald-500" style={{ width: `${coverageOk}%` }} />
                    <div className="h-full bg-red-400" style={{ width: `${100 - coverageOk}%` }} />
                  </div>
                  <div className="flex gap-6 text-xs text-gray-500">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />Al día: {fmt(portfolio - overduePortfolio)} ({coverageOk.toFixed(1)}%)</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" />En mora: {fmt(overduePortfolio)} ({(100 - coverageOk).toFixed(1)}%)</span>
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  )
}
