import { useState } from 'react'
import { X, AlertTriangle, Save, Loader2 } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { extractApiError } from '@/utils/apiError'

interface Payment {
  id: string
  payment_number: string
  receipt_number: string
  loan_number: string
  customer_name: string
  total_amount: number
  principal_amount: number
  interest_amount: number
  late_fee_amount: number
  payment_method: string
  payment_date: string
}

interface Props {
  payment: Payment
  onClose: () => void
  onSaved: () => void
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n)

export default function PaymentEditModal({ payment, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    total_amount: payment.total_amount,
    principal_amount: payment.principal_amount,
    interest_amount: payment.interest_amount,
    late_fee_amount: payment.late_fee_amount,
    payment_method: payment.payment_method,
    payment_date: payment.payment_date,
    notes: '',
    reference_number: '',
  })
  const [saving, setSaving] = useState(false)

  const totalRecalc = Number(form.principal_amount || 0) + Number(form.interest_amount || 0) + Number(form.late_fee_amount || 0)
  const totalMismatch = Math.abs(totalRecalc - Number(form.total_amount || 0)) > 0.01

  const handleSave = async () => {
    if (Number(form.total_amount) <= 0) { toast.error('El total debe ser mayor a cero'); return }
    if (totalMismatch) {
      const ok = window.confirm(
        `El total (${fmt(Number(form.total_amount))}) no coincide con la suma de capital + interés + mora (${fmt(totalRecalc)}). ¿Continuar de todos modos?`
      )
      if (!ok) return
    }
    setSaving(true)
    try {
      await api.patch(`/payments/${payment.id}/admin-edit/`, form)
      toast.success('Cobro actualizado y préstamo rebalanceado')
      onSaved()
    } catch (e: unknown) {
      toast.error(extractApiError(e, 'Error al editar el cobro'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h2 className="font-bold text-gray-900">Editar Cobro (Admin)</h2>
            <p className="text-xs text-gray-500 mt-0.5">{payment.receipt_number} · {payment.customer_name}</p>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>Editar un cobro confirmado <strong>rebalancea automáticamente</strong> el préstamo: revierte el cobro original y aplica los nuevos valores. La acción quedará registrada en las notas.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Total">
              <input type="number" step="0.01" value={form.total_amount}
                onChange={e => setForm(f => ({ ...f, total_amount: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </Field>
            <Field label="Capital">
              <input type="number" step="0.01" value={form.principal_amount}
                onChange={e => setForm(f => ({ ...f, principal_amount: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </Field>
            <Field label="Interés">
              <input type="number" step="0.01" value={form.interest_amount}
                onChange={e => setForm(f => ({ ...f, interest_amount: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </Field>
            <Field label="Mora">
              <input type="number" step="0.01" value={form.late_fee_amount}
                onChange={e => setForm(f => ({ ...f, late_fee_amount: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </Field>
            <Field label="Fecha de pago">
              <input type="date" value={form.payment_date}
                onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </Field>
            <Field label="Método">
              <select value={form.payment_method}
                onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="CASH">Efectivo</option>
                <option value="BANK_TRANSFER">Transferencia</option>
                <option value="CHECK">Cheque</option>
                <option value="CARD">Tarjeta</option>
              </select>
            </Field>
          </div>

          <Field label="Número de referencia (opcional)">
            <input type="text" value={form.reference_number}
              onChange={e => setForm(f => ({ ...f, reference_number: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </Field>

          <Field label="Motivo de la edición">
            <textarea value={form.notes} rows={3}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Ej: Cliente trajo recibo de transferencia, ajuste por error de digitación..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </Field>

          {totalMismatch && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
              Capital + Interés + Mora = {fmt(totalRecalc)} no coincide con Total = {fmt(Number(form.total_amount))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}
