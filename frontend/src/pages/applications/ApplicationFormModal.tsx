import { useState, useEffect } from 'react'
import { X, Search, Calculator, Save } from 'lucide-react'
import { applicationsService, productsService } from '@/services/applications'
import { customersService } from '@/services/customers'
import type { Customer, LoanProduct } from '@/types'
import toast from 'react-hot-toast'
import { extractApiError } from '@/utils/apiError'

interface Props {
  onClose: () => void
  onSaved: () => void
}

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'

export default function ApplicationFormModal({ onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<LoanProduct[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<LoanProduct | null>(null)
  const [simulated, setSimulated] = useState<{ monthly: number; total: number; dti: number } | null>(null)

  const [form, setForm] = useState({
    requested_amount: '',
    requested_term_months: '',
    custom_rate: '',        // tasa personalizada (vacío = usar tasa del producto)
    purpose: '',
    notes: '',
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

  // Simular cuota cuando hay datos suficientes
  useEffect(() => {
    if (!selectedProduct || !form.requested_amount || !form.requested_term_months) {
      setSimulated(null); return
    }
    const amount = parseFloat(form.requested_amount)
    const term = parseInt(form.requested_term_months)
    // Usar tasa personalizada si fue ingresada, si no usar la del producto
    const annualRate = form.custom_rate
      ? parseFloat(form.custom_rate)
      : selectedProduct.annual_interest_rate
    const rate = annualRate / 100 / 12
    if (amount <= 0 || term <= 0 || annualRate < 0) { setSimulated(null); return }
    const monthly = rate > 0
      ? amount * rate / (1 - Math.pow(1 + rate, -term))
      : amount / term
    const total = monthly * term
    const income = selectedCustomer?.monthly_income || 0
    const dti = income > 0 ? (monthly / income) * 100 : 0
    setSimulated({ monthly, total, dti })
  }, [form.requested_amount, form.requested_term_months, form.custom_rate, selectedProduct, selectedCustomer])

  const handleSave = async () => {
    if (!selectedCustomer) { toast.error('Selecciona un cliente'); return }
    if (!selectedProduct) { toast.error('Selecciona un producto'); return }
    if (!form.requested_amount) { toast.error('Ingresa el monto solicitado'); return }
    if (!form.requested_term_months) { toast.error('Ingresa el plazo'); return }
    if (!form.purpose) { toast.error('Indica el propósito del préstamo'); return }

    const amount = parseFloat(form.requested_amount)
    const minAmount = Number(selectedProduct.min_amount)
    const maxAmount = Number(selectedProduct.max_amount)
    if (amount < minAmount || amount > maxAmount) {
      toast.error(`El monto debe estar entre ${fmt(minAmount)} y ${fmt(maxAmount)}`)
      return
    }

    if (!selectedCustomer.branch) {
      toast.error('El cliente no tiene sucursal asignada. Edita el cliente primero.')
      return
    }

    setSaving(true)
    try {
      await applicationsService.create({
        customer: selectedCustomer.id,
        product: selectedProduct.id,
        branch: Number(selectedCustomer.branch),
        requested_amount: amount,
        requested_term_months: parseInt(form.requested_term_months),
        // Tasa personalizada: si se ingresó, se guarda como approved_rate
        ...(form.custom_rate ? { approved_rate: parseFloat(form.custom_rate) } : {}),
        purpose: form.purpose,
        notes: form.notes,
      })
      toast.success('Solicitud creada exitosamente')
      onSaved()
    } catch (e: unknown) {
      toast.error(extractApiError(e, 'Error creando solicitud'))
    } finally {
      setSaving(false)
    }
  }

  const fmt = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
          <h2 className="text-base sm:text-lg font-bold text-gray-900">Nueva Solicitud</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">
          {/* Buscar cliente */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Cliente <span className="text-red-500">*</span></label>
            {selectedCustomer ? (
              <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900">{selectedCustomer.full_name}</p>
                  <p className="text-xs text-gray-500">{selectedCustomer.customer_code} · {selectedCustomer.id_number} · Score: {selectedCustomer.credit_score ?? '—'}</p>
                  {selectedCustomer.monthly_income && <p className="text-xs text-emerald-600 mt-0.5">Ingresos: {fmt(selectedCustomer.monthly_income)}/mes</p>}
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

          {/* Producto */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Producto Financiero <span className="text-red-500">*</span></label>
            {selectedProduct ? (
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900">{selectedProduct.name}</p>
                  <p className="text-xs text-gray-500">Tasa: {selectedProduct.annual_interest_rate}% anual · {fmt(Number(selectedProduct.min_amount))} – {fmt(Number(selectedProduct.max_amount))} · {selectedProduct.min_term_months}-{selectedProduct.max_term_months} meses</p>
                </div>
                <button onClick={() => setSelectedProduct(null)} className="text-xs text-red-500 hover:underline">Cambiar</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                {products.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No hay productos activos</p>
                ) : products.map(p => (
                  <button key={p.id} onClick={() => setSelectedProduct(p)}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:border-primary-400 hover:bg-primary-50 transition-all text-left">
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.product_type_display} · {p.annual_interest_rate}% anual</p>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <p>{fmt(p.min_amount)} – {fmt(p.max_amount)}</p>
                      <p>{p.min_term_months} – {p.max_term_months} meses</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Monto y plazo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Monto Solicitado (RD$) <span className="text-red-500">*</span></label>
              <input
                type="number"
                min={selectedProduct?.min_amount || 0}
                max={selectedProduct?.max_amount}
                value={form.requested_amount}
                onChange={e => setForm(f => ({ ...f, requested_amount: e.target.value }))}
                className={inputCls}
                placeholder="25,000"
              />
              {selectedProduct && (
                <p className="text-xs text-gray-400 mt-1">Rango: {fmt(Number(selectedProduct.min_amount))} – {fmt(Number(selectedProduct.max_amount))}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Plazo (meses) <span className="text-red-500">*</span></label>
              <input
                type="number"
                min={selectedProduct?.min_term_months || 1}
                max={selectedProduct?.max_term_months}
                value={form.requested_term_months}
                onChange={e => setForm(f => ({ ...f, requested_term_months: e.target.value }))}
                className={inputCls}
                placeholder="12"
              />
              {selectedProduct && (
                <p className="text-xs text-gray-400 mt-1">Rango: {selectedProduct.min_term_months} – {selectedProduct.max_term_months} meses</p>
              )}
            </div>
          </div>

          {/* ── Tasa de interés personalizada ─────────────────────────────── */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                📊 Tasa de Interés Anual (%)
                <span className="font-normal text-amber-600">— Personaliza el interés para este préstamo</span>
              </label>
              {selectedProduct && !form.custom_rate && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                  Producto: {selectedProduct.annual_interest_rate}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  max="999"
                  step="0.01"
                  value={form.custom_rate}
                  onChange={e => setForm(f => ({ ...f, custom_rate: e.target.value }))}
                  className="w-full px-3 py-2.5 pr-10 border border-amber-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                  placeholder={selectedProduct ? `${selectedProduct.annual_interest_rate} (producto)` : 'Ej: 24.00'}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-600 font-bold">%</span>
              </div>
              {selectedProduct && (
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, custom_rate: String(selectedProduct.annual_interest_rate) }))}
                  className="px-3 py-2.5 bg-white border border-amber-300 rounded-lg text-xs font-medium text-amber-700 hover:bg-amber-100 whitespace-nowrap">
                  ← Del producto
                </button>
              )}
              {form.custom_rate && (
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, custom_rate: '' }))}
                  className="px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50">
                  Borrar
                </button>
              )}
            </div>
            <p className="text-xs text-amber-700">
              {form.custom_rate
                ? `✅ Se usará ${form.custom_rate}% anual · ${(parseFloat(form.custom_rate) / 12).toFixed(4)}% mensual`
                : selectedProduct
                  ? `ℹ️ Si no ingresas una tasa, se usará la del producto: ${selectedProduct.annual_interest_rate}% anual`
                  : 'Selecciona un producto para ver la tasa base'}
            </p>
          </div>

          {/* Simulación */}
          {simulated && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-slate-600 font-semibold text-sm">
                  <Calculator className="h-4 w-4" /> Simulación de Cuota
                </div>
                <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-medium">
                  Tasa: {form.custom_rate || selectedProduct?.annual_interest_rate}% anual
                  {form.custom_rate && form.custom_rate !== String(selectedProduct?.annual_interest_rate) && (
                    <span className="ml-1 text-amber-600 font-bold">★ personalizada</span>
                  )}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="text-center">
                  <p className="text-xl font-black text-primary-700">{fmt(simulated.monthly)}</p>
                  <p className="text-xs text-gray-500">Cuota mensual</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-black text-gray-700">{fmt(simulated.total)}</p>
                  <p className="text-xs text-gray-500">Total a pagar</p>
                </div>
                <div className="text-center">
                  <p className={`text-xl font-black ${simulated.dti > 50 ? 'text-red-600' : simulated.dti > 35 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {simulated.dti > 0 ? `${simulated.dti.toFixed(1)}%` : '—'}
                  </p>
                  <p className="text-xs text-gray-500">DTI ratio</p>
                </div>
              </div>
              {simulated.dti > 50 && (
                <p className="text-xs text-red-600 mt-2 text-center">⚠ Alto nivel de endeudamiento respecto a los ingresos</p>
              )}
            </div>
          )}

          {/* Propósito */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Propósito del Préstamo <span className="text-red-500">*</span></label>
            <textarea
              value={form.purpose}
              onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
              className={`${inputCls} resize-none`}
              rows={3}
              placeholder="Describe el destino de los fondos..."
            />
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notas Internas</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className={`${inputCls} resize-none`}
              rows={2}
              placeholder="Observaciones para el analista..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 font-medium"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Guardando...' : 'Crear Solicitud'}
          </button>
        </div>
      </div>
    </div>
  )
}
