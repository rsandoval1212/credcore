import { useState, useEffect, useMemo } from 'react'
import { X, Search, Calculator, Banknote, CalendarDays, Repeat, Clock, Lock, ChevronDown, ChevronUp, Table2 } from 'lucide-react'
import { productsService } from '@/services/applications'
import { customersService } from '@/services/customers'
import { loansService } from '@/services/loans'
import { useAuthStore } from '@/store/slices/authStore'
import type { Customer, LoanProduct } from '@/types'
import toast from 'react-hot-toast'
import { extractApiError } from '@/utils/apiError'
import LoanSuccessModal from './LoanSuccessModal'

interface Props {
  onClose: () => void
  onSaved: () => void
}

type Frequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'CONFIDENTIAL'

const FREQ_TABS: { key: Frequency; label: string; icon: typeof Clock; desc: string; adminOnly?: boolean }[] = [
  { key: 'WEEKLY',       label: 'Semanal',       icon: Clock,        desc: 'Ej: 13 semanas, 10 paga el cliente' },
  { key: 'BIWEEKLY',     label: 'Quincenal',     icon: Repeat,       desc: 'Pago cada 15 días' },
  { key: 'MONTHLY',      label: 'Mensual',       icon: CalendarDays, desc: 'Pago cada mes' },
  { key: 'CONFIDENTIAL', label: 'Confidencial',  icon: Lock,         desc: 'Préstamo rápido, solo admin', adminOnly: true },
]

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'

export default function DirectLoanFormModal({ onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [createdLoan, setCreatedLoan] = useState<Record<string, unknown> | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<LoanProduct[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<LoanProduct | null>(null)
  const [frequency, setFrequency] = useState<Frequency>('WEEKLY')
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.is_superuser || user?.is_staff

  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    amount: '',
    // Semanal
    total_weeks: '13',
    client_weeks: '10',
    // Quincenal / Mensual
    term: '',
    rate: '10',
    // Confidencial
    total_to_receive: '',
    days: '1',
    disbursement_date: today,
  })

  useEffect(() => {
    productsService.list({ page_size: 100 }).then(r => setProducts(r.data.results || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (customerSearch.length < 2) { setCustomers([]); return }
    const t = setTimeout(() => {
      customersService.list({ search: customerSearch, page_size: 8 })
        .then(r => setCustomers(r.data.results))
        .catch(() => {})
    }, 400)
    return () => clearTimeout(t)
  }, [customerSearch])

  // ── Simulación en tiempo real ──
  const simulation = (() => {
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) return null

    if (frequency === 'WEEKLY') {
      const totalW = parseInt(form.total_weeks) || 0
      const rate = parseFloat(form.rate) || 0
      if (totalW < 1) return null

      let cuota: number, total: number, interest: number
      if (rate > 0) {
        interest = amount * rate / 100
        total = amount + interest
        cuota = total / totalW
      } else {
        const clientW = parseInt(form.client_weeks) || 0
        if (clientW < 1 || clientW >= totalW) return null
        cuota = amount / clientW
        total = cuota * totalW
        interest = total - amount
      }
      return { cuota, total, interest, periods: totalW, profitPct: (interest / amount) * 100, label: 'semanal' }
    }

    if (frequency === 'CONFIDENTIAL') {
      const rate = parseFloat(form.rate) || 0
      let totalReceive = parseFloat(form.total_to_receive) || 0
      const days = parseInt(form.days) || 0
      if (rate > 0 && !totalReceive) totalReceive = amount * (1 + rate / 100)
      if (totalReceive <= amount || days < 1) return null
      const profit = totalReceive - amount
      return { cuota: totalReceive, total: totalReceive, interest: profit, periods: 1, profitPct: (profit / amount) * 100, label: `pago único (${days} día${days > 1 ? 's' : ''})` }
    }

    const term = parseInt(form.term) || 0
    const rate = parseFloat(form.rate) || 0
    if (term < 1 || rate < 0) return null
    const periodRate = rate / 100
    const interestTotal = amount * periodRate * term
    const total = amount + interestTotal
    const cuota = total / term
    const label = frequency === 'BIWEEKLY' ? 'quincenal' : 'mensual'
    return { cuota, total, interest: interestTotal, periods: term, profitPct: (interestTotal / amount) * 100, label }
  })()

  const schedulePreview = useMemo(() => {
    if (!simulation) return []
    const amount = parseFloat(form.amount)
    const startDate = form.disbursement_date ? new Date(form.disbursement_date + 'T00:00:00') : new Date()
    const rows: { n: number; date: string; capital: number; interest: number; cuota: number; balance: number }[] = []

    if (frequency === 'CONFIDENTIAL') {
      const days = parseInt(form.days) || 1
      const d = new Date(startDate)
      d.setDate(d.getDate() + days)
      rows.push({ n: 1, date: d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }), capital: amount, interest: simulation.interest, cuota: simulation.total, balance: 0 })
    } else {
      const capitalPerPeriod = amount / simulation.periods
      const interestPerPeriod = simulation.interest / simulation.periods
      let balance = amount
      for (let i = 1; i <= simulation.periods; i++) {
        const cap = i === simulation.periods ? balance : capitalPerPeriod
        balance = Math.max(0, balance - cap)
        const d = new Date(startDate)
        if (frequency === 'WEEKLY') d.setDate(d.getDate() + i * 7)
        else if (frequency === 'BIWEEKLY') d.setDate(d.getDate() + i * 14)
        else d.setMonth(d.getMonth() + i)
        rows.push({
          n: i,
          date: d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }),
          capital: cap,
          interest: interestPerPeriod,
          cuota: simulation.cuota,
          balance,
        })
      }
    }
    return rows
  }, [simulation, form.amount, form.disbursement_date, form.days, frequency])

  const handleSave = async () => {
    if (!selectedCustomer) { toast.error('Selecciona un cliente'); return }
    if (!selectedProduct) { toast.error('Selecciona un producto'); return }
    if (!form.amount) { toast.error('Ingresa el monto'); return }
    if (!selectedCustomer.branch) {
      toast.error('El cliente no tiene sucursal asignada. Edita el cliente primero.')
      return
    }

    if (frequency === 'WEEKLY') {
      const tw = parseInt(form.total_weeks)
      const rate = parseFloat(form.rate) || 0
      if (!tw) { toast.error('Ingresa el total de semanas'); return }
      if (rate <= 0) {
        const cw = parseInt(form.client_weeks)
        if (!cw || cw >= tw) {
          toast.error('Las semanas del cliente deben ser menores al total, o ingresa una tasa')
          return
        }
      }
    } else if (frequency === 'CONFIDENTIAL') {
      if (!isAdmin) { toast.error('Solo administradores pueden crear préstamos confidenciales'); return }
      const tr = parseFloat(form.total_to_receive)
      const d = parseInt(form.days)
      if (!tr || tr <= parseFloat(form.amount)) { toast.error('El monto a recibir debe ser mayor al monto prestado'); return }
      if (!d || d < 1) { toast.error('Ingresa los días del préstamo'); return }
    } else {
      if (!form.term) { toast.error('Ingresa el plazo'); return }
    }

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        customer: selectedCustomer.id,
        product: selectedProduct.id,
        amount: parseFloat(form.amount),
        payment_frequency: frequency,
        disbursement_date: form.disbursement_date || undefined,
      }

      if (frequency === 'WEEKLY') {
        payload.total_installments = parseInt(form.total_weeks)
        payload.client_installments = parseInt(form.client_weeks)
        payload.term_months = 1
        const rate = parseFloat(form.rate)
        if (rate > 0) payload.rate = rate
      } else if (frequency === 'CONFIDENTIAL') {
        payload.total_to_receive = parseFloat(form.total_to_receive)
        payload.days = parseInt(form.days)
        payload.is_confidential = true
        payload.term_months = 1
        const rate = parseFloat(form.rate)
        if (rate > 0) payload.rate = rate
      } else {
        payload.term_months = parseInt(form.term)
        payload.rate = parseFloat(form.rate) || 10
      }

      const res = await loansService.direct(payload as Parameters<typeof loansService.direct>[0])
      toast.success(`Préstamo ${res.data.loan_number} registrado`)
      setCreatedLoan({
        ...res.data,
        customer_phone: selectedCustomer.phone1 || selectedCustomer.whatsapp || '',
      })
    } catch (e: unknown) {
      toast.error(extractApiError(e, 'Error registrando el préstamo'))
    } finally {
      setSaving(false)
    }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n)

  if (createdLoan) {
    return (
      <LoanSuccessModal
        loan={createdLoan as unknown as Parameters<typeof LoanSuccessModal>[0]['loan']}
        onClose={() => { setCreatedLoan(null); onSaved() }}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary-600" /> Registrar Préstamo
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">
          {/* ── Modalidad ── */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Modalidad del Préstamo</label>
            <div className={`grid gap-2 ${isAdmin ? 'grid-cols-4' : 'grid-cols-3'}`}>
              {FREQ_TABS.filter(tab => !tab.adminOnly || isAdmin).map(tab => {
                const Icon = tab.icon
                const active = frequency === tab.key
                return (
                  <button
                    key={tab.key}
                    onClick={() => setFrequency(tab.key)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                      active
                        ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${active ? 'text-primary-600' : 'text-gray-400'}`} />
                    <span className="font-semibold text-sm">{tab.label}</span>
                    <span className="text-[10px] leading-tight opacity-70 hidden sm:block">{tab.desc}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Cliente ── */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Cliente <span className="text-red-500">*</span></label>
            {selectedCustomer ? (
              <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900">{selectedCustomer.full_name}</p>
                  <p className="text-xs text-gray-500">{selectedCustomer.customer_code} · {selectedCustomer.id_number}</p>
                </div>
                <button onClick={() => { setSelectedCustomer(null); setCustomerSearch('') }} className="text-xs text-red-500 hover:underline">Cambiar</button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  placeholder="Buscar cliente por nombre, cédula o código..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {customers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {customers.map(c => (
                      <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomers([]) }}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors">
                        <p className="font-medium text-sm text-gray-900">{c.full_name}</p>
                        <p className="text-xs text-gray-400">{c.customer_code} · {c.id_number}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Producto ── */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Producto Financiero <span className="text-red-500">*</span></label>
            {selectedProduct ? (
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900">{selectedProduct.name}</p>
                  <p className="text-xs text-gray-500">{selectedProduct.product_type_display} · {fmt(Number(selectedProduct.min_amount))} – {fmt(Number(selectedProduct.max_amount))}</p>
                </div>
                <button onClick={() => setSelectedProduct(null)} className="text-xs text-red-500 hover:underline">Cambiar</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                {products.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No hay productos activos</p>
                ) : products.map(p => (
                  <button key={p.id} onClick={() => setSelectedProduct(p)}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:border-primary-400 hover:bg-primary-50 transition-all text-left">
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.product_type_display}</p>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <p>{fmt(Number(p.min_amount))} – {fmt(Number(p.max_amount))}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Monto + Fecha ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Monto (RD$) <span className="text-red-500">*</span></label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className={inputCls} placeholder="10,000" min="0" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha desembolso</label>
              <input type="date" value={form.disbursement_date} onChange={e => setForm(f => ({ ...f, disbursement_date: e.target.value }))}
                className={inputCls} />
            </div>
          </div>

          {/* ── Campos por modalidad ── */}
          {frequency === 'CONFIDENTIAL' ? (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-purple-800 flex items-center gap-2">
                <Lock className="h-4 w-4" /> Préstamo Confidencial
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-purple-700 mb-1">Tasa de interés (%)</label>
                  <div className="relative">
                    <input type="number" value={form.rate} step="0.5" min="0"
                      onChange={e => {
                        const r = parseFloat(e.target.value) || 0
                        const a = parseFloat(form.amount) || 0
                        setForm(f => ({
                          ...f,
                          rate: e.target.value,
                          total_to_receive: r > 0 && a > 0 ? Math.round(a * (1 + r / 100)).toString() : f.total_to_receive,
                        }))
                      }}
                      className="w-full px-3 py-2.5 pr-10 border border-purple-300 rounded-lg text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                      placeholder="20" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-600 font-bold">%</span>
                  </div>
                  <p className="text-[10px] text-purple-500 mt-1">Auto-calcula el total</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-purple-700 mb-1">Total a recibir (RD$) <span className="text-red-500">*</span></label>
                  <input type="number" value={form.total_to_receive}
                    onChange={e => setForm(f => ({ ...f, total_to_receive: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-purple-300 rounded-lg text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                    min="0" placeholder="24,000" />
                  <p className="text-[10px] text-purple-500 mt-1">O ingrese manualmente</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-purple-700 mb-1">Días para pagar <span className="text-red-500">*</span></label>
                  <input type="number" value={form.days}
                    onChange={e => setForm(f => ({ ...f, days: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-purple-300 rounded-lg text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                    min="1" placeholder="3" />
                  <p className="text-[10px] text-purple-500 mt-1">Pago único al vencimiento</p>
                </div>
              </div>
              {parseFloat(form.amount) > 0 && parseFloat(form.total_to_receive) > parseFloat(form.amount) && (
                <p className="text-xs text-purple-600 bg-purple-100 rounded-lg px-3 py-2">
                  Ganancia: {fmt(parseFloat(form.total_to_receive) - parseFloat(form.amount))} en {form.days} día{parseInt(form.days) !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          ) : frequency === 'WEEKLY' ? (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-indigo-800 flex items-center gap-2">
                <Clock className="h-4 w-4" /> Configuración Semanal
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-indigo-700 mb-1">Total de semanas</label>
                  <input type="number" value={form.total_weeks}
                    onChange={e => setForm(f => ({ ...f, total_weeks: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-indigo-300 rounded-lg text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    min="2" placeholder="13" />
                  <p className="text-[10px] text-indigo-500 mt-1">Cuotas totales</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-indigo-700 mb-1">Semanas del cliente</label>
                  <input type="number" value={form.client_weeks}
                    onChange={e => setForm(f => ({ ...f, client_weeks: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-indigo-300 rounded-lg text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    min="1" placeholder="10"
                    disabled={parseFloat(form.rate) > 0} />
                  <p className="text-[10px] text-indigo-500 mt-1">{parseFloat(form.rate) > 0 ? 'No aplica con tasa' : 'Cubren el capital'}</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-indigo-700 mb-1">Tasa de interés (%)</label>
                  <div className="relative">
                    <input type="number" value={form.rate} step="0.5" min="0"
                      onChange={e => setForm(f => ({ ...f, rate: e.target.value }))}
                      className="w-full px-3 py-2.5 pr-10 border border-indigo-300 rounded-lg text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      placeholder="0" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-600 font-bold">%</span>
                  </div>
                  <p className="text-[10px] text-indigo-500 mt-1">Opcional: reemplaza semanas</p>
                </div>
              </div>
              {parseFloat(form.rate) > 0 && parseFloat(form.amount) > 0 && (
                <p className="text-xs text-indigo-600 bg-indigo-100 rounded-lg px-3 py-2">
                  Interés: {fmt(parseFloat(form.amount) * parseFloat(form.rate) / 100)} ({form.rate}% sobre el capital)
                </p>
              )}
              {!(parseFloat(form.rate) > 0) && parseInt(form.total_weeks) > 0 && parseInt(form.client_weeks) > 0 && parseInt(form.client_weeks) < parseInt(form.total_weeks) && (
                <p className="text-xs text-indigo-600 bg-indigo-100 rounded-lg px-3 py-2">
                  {parseInt(form.total_weeks) - parseInt(form.client_weeks)} semanas de ganancia para el prestamista
                </p>
              )}
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2">
                {frequency === 'BIWEEKLY' ? <Repeat className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
                {frequency === 'BIWEEKLY' ? 'Configuración Quincenal' : 'Configuración Mensual'}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-amber-700 mb-1">
                    {frequency === 'BIWEEKLY' ? 'Cantidad de quincenas' : 'Plazo (meses)'} <span className="text-red-500">*</span>
                  </label>
                  <input type="number" value={form.term}
                    onChange={e => setForm(f => ({ ...f, term: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-amber-300 rounded-lg text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    min="1" placeholder={frequency === 'BIWEEKLY' ? '6' : '12'} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-amber-700 mb-1">
                    Tasa {frequency === 'BIWEEKLY' ? 'quincenal' : 'mensual'} (%)
                  </label>
                  <div className="relative">
                    <input type="number" value={form.rate} step="0.5" min="0"
                      onChange={e => setForm(f => ({ ...f, rate: e.target.value }))}
                      className="w-full px-3 py-2.5 pr-10 border border-amber-300 rounded-lg text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="10" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-600 font-bold">%</span>
                  </div>
                  <p className="text-[10px] text-amber-500 mt-1">
                    El admin puede ajustar esta tasa
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Simulación ── */}
          {simulation && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-600 font-semibold text-sm mb-3">
                <Calculator className="h-4 w-4" /> Simulación
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-lg sm:text-xl font-black text-primary-700">{fmt(simulation.cuota)}</p>
                  <p className="text-[11px] text-gray-500">Cuota {simulation.label}</p>
                </div>
                <div className="text-center">
                  <p className="text-lg sm:text-xl font-black text-gray-700">{fmt(simulation.total)}</p>
                  <p className="text-[11px] text-gray-500">Total a pagar</p>
                </div>
                <div className="text-center">
                  <p className="text-lg sm:text-xl font-black text-emerald-600">{fmt(simulation.interest)}</p>
                  <p className="text-[11px] text-gray-500">Ganancia ({simulation.profitPct.toFixed(1)}%)</p>
                </div>
              </div>
              <p className="text-[11px] text-gray-400 text-center mt-2">
                {simulation.periods} cuotas de {fmt(simulation.cuota)}
              </p>
              <button
                onClick={() => setShowSchedule(s => !s)}
                className="flex items-center gap-1.5 mx-auto mt-3 text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors"
              >
                <Table2 className="h-3.5 w-3.5" />
                {showSchedule ? 'Ocultar' : 'Ver'} tabla de cuotas
                {showSchedule ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {showSchedule && schedulePreview.length > 0 && (
                <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 sticky top-0">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-semibold text-slate-600">#</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-slate-600">Vencimiento</th>
                        <th className="px-2 py-1.5 text-right font-semibold text-slate-600">Capital</th>
                        <th className="px-2 py-1.5 text-right font-semibold text-slate-600">Interés</th>
                        <th className="px-2 py-1.5 text-right font-semibold text-slate-600">Cuota</th>
                        <th className="px-2 py-1.5 text-right font-semibold text-slate-600">Saldo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {schedulePreview.map(r => (
                        <tr key={r.n} className="hover:bg-slate-50">
                          <td className="px-2 py-1 text-slate-500">{r.n}</td>
                          <td className="px-2 py-1 text-slate-700">{r.date}</td>
                          <td className="px-2 py-1 text-right text-slate-700">{fmt(r.capital)}</td>
                          <td className="px-2 py-1 text-right text-slate-500">{fmt(r.interest)}</td>
                          <td className="px-2 py-1 text-right font-semibold text-slate-900">{fmt(r.cuota)}</td>
                          <td className="px-2 py-1 text-right text-slate-500">{fmt(r.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center justify-center gap-2 px-5 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 font-medium">
            <Banknote className="h-4 w-4" />
            {saving ? 'Registrando...' : 'Registrar Préstamo'}
          </button>
        </div>
      </div>
    </div>
  )
}
