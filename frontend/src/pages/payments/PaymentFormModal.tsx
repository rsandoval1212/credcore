import { useState, useEffect } from 'react'
import { X, Search, Save, Calculator, CheckCircle, MessageCircle } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { notificationsService } from '@/services/notifications'
import { extractApiError } from '@/utils/apiError'
import { useAuthStore } from '@/store/slices/authStore'
import AdminConfirmModal from '@/components/ui/AdminConfirmModal'

interface Props { onClose: () => void; onSaved: () => void }

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
const fmt = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n)

export default function PaymentFormModal({ onClose, onSaved }: Props) {
  const { user } = useAuthStore()
  const isAdmin = user?.is_superuser || user?.is_staff
  const [saving, setSaving] = useState(false)
  const [showAdminConfirm, setShowAdminConfirm] = useState(false)
  const [successPayment, setSuccessPayment] = useState<{ id: string; receipt_number: string; total_amount: number; customer_name: string } | null>(null)
  const [sendingWa, setSendingWa] = useState(false)
  const [loans, setLoans] = useState<{ id: string; loan_number: string; customer_name: string; outstanding_principal: number; outstanding_interest: number; outstanding_late_fees: number; monthly_payment: number }[]>([])
  const [loanSearch, setLoanSearch] = useState('')
  const [selectedLoan, setSelectedLoan] = useState<typeof loans[0] | null>(null)
  const [form, setForm] = useState({
    total_amount: '', principal_amount: '', interest_amount: '', late_fee_amount: '0',
    payment_type: 'REGULAR', payment_method: 'CASH',
    payment_date: new Date().toISOString().slice(0, 10),
    reference_number: '', bank_name: '', notes: '',
  })

  useEffect(() => {
    if (loanSearch.length < 2) { setLoans([]); return }
    const t = setTimeout(async () => {
      try {
        const r = await api.get('/loans/', { params: { search: loanSearch, status: 'ACTIVE', page_size: 8 } })
        setLoans(r.data.results.map((l: Record<string, unknown>) => ({
          id: l.id,
          loan_number: l.loan_number,
          customer_name: l.customer_name,
          outstanding_principal: Number(l.outstanding_principal),
          outstanding_interest:  Number(l.outstanding_interest),
          outstanding_late_fees: Number(l.outstanding_late_fees),
          monthly_payment:       Number(l.monthly_payment),
        })))
      } catch {}
    }, 400)
    return () => clearTimeout(t)
  }, [loanSearch])

  const selectLoan = (loan: typeof loans[0]) => {
    setSelectedLoan(loan)
    setLoans([])
    const total = loan.monthly_payment
    setForm(f => ({
      ...f,
      total_amount: String(total),
      principal_amount: String(loan.outstanding_principal > 0 ? Math.min(total * 0.7, loan.outstanding_principal) : 0),
      interest_amount: String(loan.outstanding_interest > 0 ? Math.min(total * 0.3, loan.outstanding_interest) : 0),
      late_fee_amount: String(loan.outstanding_late_fees || 0),
    }))
  }

  const doSave = async () => {
    if (!selectedLoan) return
    setSaving(true)
    try {
      const r = await api.post('/payments/', {
        loan: selectedLoan.id,
        total_amount: parseFloat(form.total_amount),
        principal_amount: parseFloat(form.principal_amount) || 0,
        interest_amount: parseFloat(form.interest_amount) || 0,
        late_fee_amount: parseFloat(form.late_fee_amount) || 0,
        payment_type: form.payment_type,
        payment_method: form.payment_method,
        payment_date: form.payment_date,
        reference_number: form.reference_number,
        bank_name: form.bank_name,
        notes: form.notes,
      })
      toast.success('Cobro registrado exitosamente')
      setSuccessPayment({
        id: r.data.id,
        receipt_number: r.data.receipt_number,
        total_amount: parseFloat(r.data.total_amount),
        customer_name: selectedLoan!.customer_name,
      })
    } catch (e: unknown) {
      toast.error(extractApiError(e, 'Error registrando cobro'))
    } finally { setSaving(false) }
  }

  const handleSave = () => {
    if (!selectedLoan) { toast.error('Selecciona un préstamo'); return }
    if (!form.total_amount) { toast.error('Ingresa el monto'); return }
    // Non-admin users need admin authorization for payments
    if (!isAdmin) {
      setShowAdminConfirm(true)
      return
    }
    doSave()
  }

  const handleSendReceipt = async () => {
    if (!successPayment) return
    setSendingWa(true)
    try {
      const r = await notificationsService.getReceiptWhatsApp(successPayment.id)
      if (!r.data.wa_phone) {
        toast.error('El cliente no tiene WhatsApp registrado')
        return
      }
      notificationsService.openWhatsApp(r.data.wa_url)
      toast.success('Recibo enviado por WhatsApp', { icon: '📱' })
    } catch {
      toast.error('Error generando recibo')
    } finally {
      setSendingWa(false)
    }
  }

  // Modal de éxito con opción de enviar recibo por WhatsApp
  if (successPayment) {
    const fmtMoney = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 2 }).format(n)
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-9 w-9 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">¡Cobro Registrado!</h2>
          <p className="text-sm text-gray-500 mt-1">Recibo: <span className="font-mono font-semibold">{successPayment.receipt_number}</span></p>

          <div className="bg-gray-50 rounded-xl p-4 mt-4 text-left space-y-1">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Cliente:</span><span className="font-medium text-gray-900">{successPayment.customer_name}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Total cobrado:</span><span className="font-bold text-emerald-600">{fmtMoney(successPayment.total_amount)}</span></div>
          </div>

          <div className="mt-5 space-y-2">
            <button onClick={handleSendReceipt} disabled={sendingWa}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-60">
              <MessageCircle className="h-5 w-5" />
              {sendingWa ? 'Abriendo WhatsApp...' : 'Enviar recibo por WhatsApp'}
            </button>
            <button onClick={onSaved}
              className="w-full py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600">
              Cerrar sin enviar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Registrar Cobro</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X className="h-5 w-5 text-gray-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Préstamo */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Préstamo *</label>
            {selectedLoan ? (
              <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900">{selectedLoan.loan_number}</p>
                  <p className="text-xs text-gray-500">{selectedLoan.customer_name}</p>
                  <p className="text-xs text-emerald-600 mt-1">
                    Saldo: {fmt(selectedLoan.outstanding_principal + selectedLoan.outstanding_interest + selectedLoan.outstanding_late_fees)}
                    · Cuota: {fmt(selectedLoan.monthly_payment)}
                  </p>
                </div>
                <button onClick={() => setSelectedLoan(null)} className="text-xs text-red-500 hover:underline">Cambiar</button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input value={loanSearch} onChange={e => setLoanSearch(e.target.value)}
                  placeholder="Buscar por número de préstamo o cliente..." className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                {loans.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                    {loans.map(l => (
                      <button key={l.id} onClick={() => selectLoan(l)} className="w-full text-left px-4 py-2.5 hover:bg-gray-50">
                        <p className="font-mono text-sm font-semibold text-gray-900">{l.loan_number}</p>
                        <p className="text-xs text-gray-400">{l.customer_name} · Cuota: {fmt(l.monthly_payment)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Montos */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Total a Cobrar (RD$) *</label>
              <div className="relative">
                <input type="number" min="0" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} className={inputCls} placeholder="0.00" />
                {selectedLoan && (
                  <button onClick={() => setForm(f => ({ ...f, total_amount: String(selectedLoan.monthly_payment) }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-primary-600 hover:underline">
                    <Calculator className="h-3 w-3" /> Cuota
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Capital</label>
              <input type="number" min="0" value={form.principal_amount} onChange={e => setForm(f => ({ ...f, principal_amount: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Interés</label>
              <input type="number" min="0" value={form.interest_amount} onChange={e => setForm(f => ({ ...f, interest_amount: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Mora</label>
              <input type="number" min="0" value={form.late_fee_amount} onChange={e => setForm(f => ({ ...f, late_fee_amount: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha de pago *</label>
              <input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} className={inputCls} />
            </div>
          </div>

          {/* Tipo y método */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo de pago</label>
              <select value={form.payment_type} onChange={e => setForm(f => ({ ...f, payment_type: e.target.value }))} className={inputCls}>
                <option value="REGULAR">Regular</option>
                <option value="PARTIAL">Parcial</option>
                <option value="EXTRAORDINARY">Extraordinario</option>
                <option value="FULL_PAYMENT">Cancelación Total</option>
                <option value="LATE_FEE">Solo Mora</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Método de pago</label>
              <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} className={inputCls}>
                <option value="CASH">Efectivo</option>
                <option value="BANK_TRANSFER">Transferencia</option>
                <option value="CHECK">Cheque</option>
                <option value="CARD">Tarjeta</option>
              </select>
            </div>
          </div>

          {/* Referencia bancaria */}
          {(form.payment_method === 'BANK_TRANSFER' || form.payment_method === 'CHECK') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Banco</label>
                <input value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} className={inputCls} placeholder="Nombre del banco" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nro. referencia</label>
                <input value={form.reference_number} onChange={e => setForm(f => ({ ...f, reference_number: e.target.value }))} className={inputCls} placeholder="Referencia / cheque" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notas</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={`${inputCls} resize-none`} rows={2} />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 font-medium">
            <Save className="h-4 w-4" />{saving ? 'Guardando...' : 'Registrar Cobro'}
          </button>
        </div>
      </div>

      {showAdminConfirm && (
        <AdminConfirmModal
          action={`Registrar cobro de ${form.total_amount ? fmt(parseFloat(form.total_amount)) : 'RD$0'} al préstamo ${selectedLoan?.loan_number || ''}`}
          onConfirmed={() => { setShowAdminConfirm(false); doSave() }}
          onClose={() => setShowAdminConfirm(false)}
        />
      )}
    </div>
  )
}
