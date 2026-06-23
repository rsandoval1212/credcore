import { useState } from 'react'
import { X, Save, Loader2, AlertTriangle } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { extractApiError } from '@/utils/apiError'
import type { Loan } from '@/types'

interface Props {
  loan: Loan
  onClose: () => void
  onSaved: () => void
}

export default function LoanEditModal({ loan, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    notes: loan.notes || '',
    maturity_date: loan.maturity_date || '',
    first_payment_date: loan.first_payment_date || '',
    late_fee_rate: String(loan.late_fee_rate ?? 0),
    commission_amount: String(loan.commission_amount ?? 0),
    is_confidential: loan.is_confidential || false,
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.patch(`/loans/${loan.id}/admin-edit/`, form)
      toast.success('Préstamo actualizado')
      onSaved()
    } catch (e: unknown) {
      toast.error(extractApiError(e, 'Error al actualizar'))
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-gray-100">Editar Préstamo (Admin)</h2>
            <p className="text-xs text-gray-500 mt-0.5">{loan.loan_number}</p>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-200 flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>Edita información del préstamo. Para cambiar plazo/cuota usa "Renegociar". Para editar montos usa "Editar cobro" en cada pago.</p>
          </div>

          <Field label="Fecha de vencimiento">
            <input type="date" value={form.maturity_date}
              onChange={e => setForm(f => ({ ...f, maturity_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-700" />
          </Field>

          <Field label="Fecha del primer pago">
            <input type="date" value={form.first_payment_date}
              onChange={e => setForm(f => ({ ...f, first_payment_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-700" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tasa de mora (%)">
              <input type="number" step="0.01" value={form.late_fee_rate}
                onChange={e => setForm(f => ({ ...f, late_fee_rate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-700" />
            </Field>
            <Field label="Comisión">
              <input type="number" step="0.01" value={form.commission_amount}
                onChange={e => setForm(f => ({ ...f, commission_amount: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-700" />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.is_confidential}
              onChange={e => setForm(f => ({ ...f, is_confidential: e.target.checked }))} />
            <span className="text-gray-700 dark:text-gray-300">Préstamo confidencial (solo visible a admins)</span>
          </label>

          <Field label="Notas">
            <textarea value={form.notes} rows={4}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Observaciones adicionales sobre el préstamo..."
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-700" />
          </Field>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex gap-3 sticky bottom-0 bg-white dark:bg-gray-800">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700">Cancelar</button>
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
      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  )
}
