import { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeftRight, RefreshCw, Plus, TrendingUp, TrendingDown,
  DollarSign, X, Save, Search, Ban, Calculator, Settings,
} from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface Rate { id: number; date: string; buy_rate: number; sell_rate: number; spread: number; reference_rate: number; is_active: boolean }
interface Txn {
  id: string; receipt_number: string; operation: string; operation_display: string
  status: string; status_display: string; rate_applied: number
  usd_amount: number; dop_amount: number; profit: number
  customer_display: string; customer_name: string; customer_id_number: string
  payment_method: string; payment_method_display: string; operator_name: string
  notes: string; created_at: string
}
interface Stats {
  today_buy_count: number; today_buy_usd: number; today_buy_dop: number
  today_sell_count: number; today_sell_usd: number; today_sell_dop: number
  today_profit: number; month_profit: number; month_count: number
  current_buy_rate: number; current_sell_rate: number; current_spread: number
  total_profit: number; total_transactions: number
}

/* ── Formatters ────────────────────────────────────────────────────────────── */
const fmtDOP = (n?: number | null) =>
  n == null ? 'RD$0.00' : new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)
const fmtUSD = (n?: number | null) =>
  n == null ? 'US$0.00' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
const fmtRate = (n?: number | null) => n == null ? '0.0000' : Number(n).toFixed(4)
const fmtDt = (d?: string) =>
  !d ? '—' : new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/* ── Component ─────────────────────────────────────────────────────────────── */
export default function CurrencyExchangePage() {
  const [tab, setTab] = useState<'operations' | 'rates'>('operations')
  const [transactions, setTransactions] = useState<Txn[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [rates, setRates] = useState<Rate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modals
  const [showNewTxn, setShowNewTxn] = useState(false)
  const [showNewRate, setShowNewRate] = useState(false)
  const [showCalc, setShowCalc] = useState(false)

  // Transaction form
  const [txnForm, setTxnForm] = useState({
    operation: 'BUY' as 'BUY' | 'SELL',
    usd_amount: '',
    rate_applied: '',
    customer_name: '',
    customer_id_number: '',
    customer_phone: '',
    payment_method: 'CASH',
    reference_number: '',
    notes: '',
  })

  // Rate form
  const [rateForm, setRateForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    buy_rate: '',
    sell_rate: '',
    reference_rate: '',
    notes: '',
  })

  // Calculator
  const [calcOp, setCalcOp] = useState<'BUY' | 'SELL'>('BUY')
  const [calcAmount, setCalcAmount] = useState('')
  const [calcCurrency, setCalcCurrency] = useState<'USD' | 'DOP'>('USD')
  const [calcResult, setCalcResult] = useState<{ usd_amount: number; dop_amount: number; rate: number } | null>(null)

  const [saving, setSaving] = useState(false)

  /* ── Load data ───────────────────────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [t, s, r] = await Promise.all([
        api.get('/currency-exchange/transactions/', { params: { search, ordering: '-created_at' } }),
        api.get('/currency-exchange/transactions/stats/'),
        api.get('/currency-exchange/rates/', { params: { ordering: '-date' } }),
      ])
      setTransactions(t.data.results || t.data)
      setStats(s.data)
      setRates(r.data.results || r.data)
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  /* ── Computed values for live preview ────────────────────────────────────── */
  const liveUsd = parseFloat(txnForm.usd_amount) || 0
  const liveRate = parseFloat(txnForm.rate_applied) ||
    (stats ? (txnForm.operation === 'BUY' ? stats.current_buy_rate : stats.current_sell_rate) : 0)
  const liveDop = (liveUsd * liveRate)

  /* ── Create transaction ──────────────────────────────────────────────────── */
  const handleCreateTxn = async () => {
    if (!txnForm.usd_amount || parseFloat(txnForm.usd_amount) <= 0) {
      toast.error('Ingresa un monto en USD válido'); return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        operation: txnForm.operation,
        usd_amount: parseFloat(txnForm.usd_amount),
        customer_name: txnForm.customer_name,
        customer_id_number: txnForm.customer_id_number,
        customer_phone: txnForm.customer_phone,
        payment_method: txnForm.payment_method,
        reference_number: txnForm.reference_number,
        notes: txnForm.notes,
      }
      if (txnForm.rate_applied) payload.rate_applied = parseFloat(txnForm.rate_applied)

      const res = await api.post('/currency-exchange/transactions/', payload)
      const op = res.data.operation === 'BUY' ? 'Compra' : 'Venta'
      toast.success(`${op} registrada: ${res.data.receipt_number}`)
      setShowNewTxn(false)
      setTxnForm({ operation: 'BUY', usd_amount: '', rate_applied: '', customer_name: '', customer_id_number: '', customer_phone: '', payment_method: 'CASH', reference_number: '', notes: '' })
      load()
    } catch (e: any) {
      const data = e.response?.data
      let msg = 'Error al registrar la operación'
      if (data) {
        if (typeof data.detail === 'string') msg = data.detail
        else if (data.detail?.[0]) msg = data.detail[0]
        else if (data.customer_id_number?.[0]) msg = data.customer_id_number[0]
        else if (typeof data === 'object') {
          const first = Object.values(data).flat()[0]
          if (typeof first === 'string') msg = first
        }
      }
      toast.error(msg)
    } finally { setSaving(false) }
  }

  /* ── Create rate ─────────────────────────────────────────────────────────── */
  const handleCreateRate = async () => {
    if (!rateForm.buy_rate || !rateForm.sell_rate) {
      toast.error('Ingresa las tasas de compra y venta'); return
    }
    setSaving(true)
    try {
      await api.post('/currency-exchange/rates/', {
        date: rateForm.date,
        buy_rate: parseFloat(rateForm.buy_rate),
        sell_rate: parseFloat(rateForm.sell_rate),
        reference_rate: rateForm.reference_rate ? parseFloat(rateForm.reference_rate) : null,
        notes: rateForm.notes,
      })
      toast.success('Tasa de cambio configurada')
      setShowNewRate(false)
      setRateForm({ date: new Date().toISOString().slice(0, 10), buy_rate: '', sell_rate: '', reference_rate: '', notes: '' })
      load()
    } catch (e: any) {
      toast.error(e.response?.data?.date?.[0] || 'Error al guardar tasa')
    } finally { setSaving(false) }
  }

  /* ── Cancel transaction ──────────────────────────────────────────────────── */
  const handleCancel = async (id: string) => {
    if (!confirm('¿Anular esta transacción?')) return
    try {
      await api.post(`/currency-exchange/transactions/${id}/cancel/`, { reason: 'Anulada por operador' })
      toast.success('Transacción anulada')
      load()
    } catch { toast.error('Error al anular') }
  }

  /* ── Calculator ──────────────────────────────────────────────────────────── */
  const handleCalc = async () => {
    if (!calcAmount) return
    try {
      const res = await api.get('/currency-exchange/transactions/calculator/', {
        params: { operation: calcOp, amount: calcAmount, currency: calcCurrency }
      })
      setCalcResult(res.data)
    } catch { toast.error('Configure una tasa de cambio primero') }
  }

  /* ── Render ──────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ArrowLeftRight className="h-7 w-7 text-green-600" />
            Cambio de Divisas
          </h1>
          <p className="text-sm text-gray-500 mt-1">Compra y venta de dólares (USD/DOP)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCalc(true)} className="btn-outline flex items-center gap-1 px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm">
            <Calculator className="h-4 w-4" /> Calculadora
          </button>
          <button onClick={() => setShowNewRate(true)} className="flex items-center gap-1 px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm">
            <Settings className="h-4 w-4" /> Configurar Tasa
          </button>
          <button onClick={() => {
            if (!stats?.current_buy_rate) {
              toast.error('Primero configure una tasa de cambio del día')
              setShowNewRate(true)
              return
            }
            setShowNewTxn(true)
          }} className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
            <Plus className="h-4 w-4" /> Nueva Operación
          </button>
          <button onClick={load} disabled={loading} className="p-2 border rounded-lg hover:bg-gray-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Alert: No rate configured */}
      {stats && !stats.current_buy_rate && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
            <Settings className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-amber-800">No hay tasa de cambio configurada</p>
            <p className="text-sm text-amber-600">Debe configurar la tasa del día antes de registrar operaciones de compra/venta.</p>
          </div>
          <button onClick={() => setShowNewRate(true)} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 shrink-0">
            Configurar Tasa
          </button>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {/* Tasa Actual */}
          <div className="bg-white rounded-xl border p-4">
            <div className="text-xs text-gray-500 mb-1">Tasa Compra</div>
            <div className="text-xl font-bold text-blue-600">{fmtRate(stats.current_buy_rate)}</div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="text-xs text-gray-500 mb-1">Tasa Venta</div>
            <div className="text-xl font-bold text-red-600">{fmtRate(stats.current_sell_rate)}</div>
          </div>
          {/* Hoy */}
          <div className="bg-white rounded-xl border p-4">
            <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><TrendingDown className="h-3 w-3 text-blue-500" /> Compras Hoy</div>
            <div className="text-lg font-bold">{fmtUSD(stats.today_buy_usd)}</div>
            <div className="text-xs text-gray-400">{stats.today_buy_count} ops</div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><TrendingUp className="h-3 w-3 text-red-500" /> Ventas Hoy</div>
            <div className="text-lg font-bold">{fmtUSD(stats.today_sell_usd)}</div>
            <div className="text-xs text-gray-400">{stats.today_sell_count} ops</div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><DollarSign className="h-3 w-3 text-green-500" /> Ganancia Hoy</div>
            <div className="text-lg font-bold text-green-600">{fmtDOP(stats.today_profit)}</div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="text-xs text-gray-500 mb-1">Ganancia Mes</div>
            <div className="text-lg font-bold text-green-600">{fmtDOP(stats.month_profit)}</div>
            <div className="text-xs text-gray-400">{stats.month_count} ops</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button onClick={() => setTab('operations')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'operations' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
          Operaciones
        </button>
        <button onClick={() => setTab('rates')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'rates' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
          Historial de Tasas
        </button>
      </div>

      {/* Tab: Operations */}
      {tab === 'operations' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="p-4 border-b flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input type="text" placeholder="Buscar por recibo, cliente, cédula..." value={search} onChange={e => setSearch(e.target.value)}
                className="pl-10 pr-3 py-2 border rounded-lg w-full text-sm" />
            </div>
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
                  <th className="px-4 py-3">Pago</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transactions.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-12 text-center text-gray-400">No hay operaciones de cambio registradas</td></tr>
                ) : transactions.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{t.receipt_number}</td>
                    <td className="px-4 py-3 text-xs">{fmtDt(t.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${t.operation === 'BUY' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                        {t.operation === 'BUY' ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                        {t.operation_display}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[150px] truncate">{t.customer_display}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmtUSD(t.usd_amount)}</td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500">{fmtRate(t.rate_applied)}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmtDOP(t.dop_amount)}</td>
                    <td className="px-4 py-3 text-right text-green-600 font-medium">{fmtDOP(t.profit)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                        t.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{t.status_display}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{t.payment_method_display}</td>
                    <td className="px-4 py-3">
                      {t.status === 'COMPLETED' && (
                        <button onClick={() => handleCancel(t.id)} className="text-red-500 hover:text-red-700" title="Anular">
                          <Ban className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Rates History */}
      {tab === 'rates' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3 text-right">Compra</th>
                  <th className="px-4 py-3 text-right">Venta</th>
                  <th className="px-4 py-3 text-right">Spread</th>
                  <th className="px-4 py-3 text-right">Referencia BC</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rates.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No hay tasas configuradas</td></tr>
                ) : rates.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{r.date}</td>
                    <td className="px-4 py-3 text-right text-blue-600 font-medium">{fmtRate(r.buy_rate)}</td>
                    <td className="px-4 py-3 text-right text-red-600 font-medium">{fmtRate(r.sell_rate)}</td>
                    <td className="px-4 py-3 text-right text-green-600">{fmtRate(r.spread)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{r.reference_rate ? fmtRate(r.reference_rate) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {r.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: Nueva Operación ─────────────────────────────────────────── */}
      {showNewTxn && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold">Nueva Operación de Cambio</h2>
              <button onClick={() => setShowNewTxn(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Operation Type Toggle */}
              <div className="flex gap-2">
                <button onClick={() => setTxnForm(f => ({ ...f, operation: 'BUY' }))}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold transition ${txnForm.operation === 'BUY' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  <TrendingDown className="h-5 w-5 inline mr-1" /> COMPRA USD
                </button>
                <button onClick={() => setTxnForm(f => ({ ...f, operation: 'SELL' }))}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold transition ${txnForm.operation === 'SELL' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  <TrendingUp className="h-5 w-5 inline mr-1" /> VENTA USD
                </button>
              </div>

              {/* Amount + Rate */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Monto USD *</label>
                  <input type="number" step="0.01" min="0.01" value={txnForm.usd_amount}
                    onChange={e => setTxnForm(f => ({ ...f, usd_amount: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="0.00" autoFocus />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Tasa {txnForm.operation === 'BUY' ? 'Compra' : 'Venta'}
                    <span className="text-gray-400 ml-1">(dejar vacío = tasa del día)</span>
                  </label>
                  <input type="number" step="0.0001" value={txnForm.rate_applied}
                    onChange={e => setTxnForm(f => ({ ...f, rate_applied: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder={stats ? fmtRate(txnForm.operation === 'BUY' ? stats.current_buy_rate : stats.current_sell_rate) : '0.0000'} />
                </div>
              </div>

              {/* Live preview */}
              {liveUsd > 0 && (
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="text-xs text-gray-500 mb-1">
                    {txnForm.operation === 'BUY' ? 'Cliente recibe' : 'Cliente paga'}
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{fmtDOP(liveDop)}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {fmtUSD(liveUsd)} × {fmtRate(liveRate)}
                  </div>
                </div>
              )}

              {/* Customer Info */}
              <div className="border-t pt-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Datos del Cliente</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
                    <input type="text" value={txnForm.customer_name}
                      onChange={e => setTxnForm(f => ({ ...f, customer_name: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Nombre completo" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Cédula/Pasaporte {liveUsd >= 500 && <span className="text-red-500">*</span>}
                    </label>
                    <input type="text" value={txnForm.customer_id_number}
                      onChange={e => setTxnForm(f => ({ ...f, customer_id_number: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="000-0000000-0" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
                    <input type="text" value={txnForm.customer_phone}
                      onChange={e => setTxnForm(f => ({ ...f, customer_phone: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="809-000-0000" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Método de Pago</label>
                    <select value={txnForm.payment_method} onChange={e => setTxnForm(f => ({ ...f, payment_method: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm">
                      <option value="CASH">Efectivo</option>
                      <option value="TRANSFER">Transferencia</option>
                      <option value="CHECK">Cheque</option>
                    </select>
                  </div>
                </div>
                {txnForm.payment_method !== 'CASH' && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">No. Referencia</label>
                    <input type="text" value={txnForm.reference_number}
                      onChange={e => setTxnForm(f => ({ ...f, reference_number: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Número de referencia" />
                  </div>
                )}
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
                  <textarea value={txnForm.notes} onChange={e => setTxnForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t">
              <button onClick={() => setShowNewTxn(false)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button onClick={handleCreateTxn} disabled={saving}
                className={`px-6 py-2 rounded-lg text-sm font-medium text-white ${txnForm.operation === 'BUY' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}>
                {saving ? 'Registrando...' : <><Save className="h-4 w-4 inline mr-1" /> Registrar {txnForm.operation === 'BUY' ? 'Compra' : 'Venta'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Configurar Tasa ─────────────────────────────────────────── */}
      {showNewRate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold">Configurar Tasa de Cambio</h2>
              <button onClick={() => setShowNewRate(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
                <input type="date" value={rateForm.date}
                  onChange={e => setRateForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tasa Compra (DOP por 1 USD) *</label>
                  <input type="number" step="0.0001" value={rateForm.buy_rate}
                    onChange={e => setRateForm(f => ({ ...f, buy_rate: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="58.5000" autoFocus />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tasa Venta (DOP por 1 USD) *</label>
                  <input type="number" step="0.0001" value={rateForm.sell_rate}
                    onChange={e => setRateForm(f => ({ ...f, sell_rate: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="59.5000" />
                </div>
              </div>
              {rateForm.buy_rate && rateForm.sell_rate && (
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <span className="text-xs text-gray-500">Spread: </span>
                  <span className="font-bold text-green-700">
                    {(parseFloat(rateForm.sell_rate) - parseFloat(rateForm.buy_rate)).toFixed(4)} DOP
                  </span>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tasa Referencia Banco Central</label>
                <input type="number" step="0.0001" value={rateForm.reference_rate}
                  onChange={e => setRateForm(f => ({ ...f, reference_rate: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Opcional" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
                <input type="text" value={rateForm.notes}
                  onChange={e => setRateForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t">
              <button onClick={() => setShowNewRate(false)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button onClick={handleCreateRate} disabled={saving}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
                {saving ? 'Guardando...' : <><Save className="h-4 w-4 inline mr-1" /> Guardar Tasa</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Calculadora ─────────────────────────────────────────────── */}
      {showCalc && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold flex items-center gap-2"><Calculator className="h-5 w-5" /> Calculadora de Cambio</h2>
              <button onClick={() => { setShowCalc(false); setCalcResult(null) }}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-2">
                <button onClick={() => setCalcOp('BUY')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${calcOp === 'BUY' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Compra</button>
                <button onClick={() => setCalcOp('SELL')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${calcOp === 'SELL' ? 'bg-red-600 text-white' : 'bg-gray-100'}`}>Venta</button>
              </div>
              <div className="flex gap-2">
                <input type="number" value={calcAmount} onChange={e => setCalcAmount(e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm" placeholder="Monto" autoFocus />
                <select value={calcCurrency} onChange={e => setCalcCurrency(e.target.value as 'USD' | 'DOP')}
                  className="border rounded-lg px-3 py-2 text-sm">
                  <option value="USD">USD</option>
                  <option value="DOP">DOP</option>
                </select>
                <button onClick={handleCalc} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">Calcular</button>
              </div>
              {calcResult && (
                <div className="bg-gray-50 rounded-xl p-4 text-center space-y-2">
                  <div className="text-2xl font-bold">{fmtUSD(calcResult.usd_amount)}</div>
                  <ArrowLeftRight className="h-5 w-5 mx-auto text-gray-400" />
                  <div className="text-2xl font-bold">{fmtDOP(calcResult.dop_amount)}</div>
                  <div className="text-xs text-gray-400">Tasa: {fmtRate(calcResult.rate)}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
