import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle, RefreshCw, Phone, MapPin, FileText,
  MessageCircle, Search, ChevronLeft, ChevronRight,
  Plus, CheckCircle, XCircle,
} from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface OverdueLoan {
  id: string; loan_number: string; customer_name: string; customer_code: string
  days_past_due: number; outstanding_principal: number; outstanding_interest: number
  outstanding_late_fees: number; status: string; branch_name: string; officer_name: string
  product_name: string
}
interface CollectionAction {
  id: number; loan: string; customer: number; loan_number: string; customer_name: string
  action_type: string; action_type_display: string; result: string; result_display: string
  notes: string; performed_by_name: string; next_action_date: string | null
  days_past_due_at_action: number; amount_owed_at_action: number; created_at: string
}
interface Agreement {
  id: number; loan: string; loan_number: string; customer_name: string
  agreed_amount: number; agreed_payment_date: string
  status: string; status_display: string; is_overdue: boolean; notes: string
}
interface Stats {
  total: number; month_count: number; today_count: number
  promises: number; agreements: number; no_contact: number
}

// ─── Formateo ─────────────────────────────────────────────────────────────────
const fmt = (n?: number | null) =>
  n == null ? 'RD$0' :
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n)

const fmtDate = (d?: string | null) =>
  !d ? '—' : new Date(d + 'T00:00:00').toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })

/** Semáforo de mora: 🟢 al día | 🟡 1-15 | 🟠 16-30 | 🔴 +30 */
const MoraSemaforo = ({ days }: { days: number }) => {
  if (days === 0) return <span title="Al día"       className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">🟢 Al día</span>
  if (days <= 15) return <span title="1-15 días"    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-200">🟡 {days}d</span>
  if (days <= 30) return <span title="16-30 días"   className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200">🟠 {days}d</span>
  return               <span title="+30 días"       className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">🔴 {days}d</span>
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  CALL:      <Phone className="h-3.5 w-3.5" />,
  VISIT:     <MapPin className="h-3.5 w-3.5" />,
  NOTICE:    <FileText className="h-3.5 w-3.5" />,
  SMS:       <MessageCircle className="h-3.5 w-3.5" />,
  WHATSAPP:  <MessageCircle className="h-3.5 w-3.5 text-green-600" />,
  AGREEMENT: <HandshakeIcon className="h-3.5 w-3.5" />,
  LEGAL:     <AlertTriangle className="h-3.5 w-3.5 text-red-600" />,
}

const TABS = [
  { id: 'mora',      label: 'Cartera en Mora',   icon: AlertTriangle },
  { id: 'acciones',  label: 'Acciones de Cobro', icon: Phone },
  { id: 'acuerdos',  label: 'Acuerdos de Pago',  icon: HandshakeIcon },
]

// ─── Modal: Nueva Acción ──────────────────────────────────────────────────────
function ActionModal({ loanId, customerId, onClose, onSave }: {
  loanId: string; customerId: number; onClose: () => void; onSave: () => void
}) {
  const [form, setForm] = useState({
    loan: loanId, customer: customerId,
    action_type: 'CALL', result: '', notes: '',
    next_action_date: '', next_action_type: '',
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.notes.trim()) { toast.error('Escribe las notas de la acción'); return }
    setSaving(true)
    try {
      await api.post('/collections/actions/', form)
      toast.success('Acción registrada')
      onSave()
    } catch { toast.error('Error registrando acción') } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Nueva Acción de Cobro</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <XCircle className="h-5 w-5 text-gray-400" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo de Acción</label>
              <select value={form.action_type} onChange={e => setForm(f => ({ ...f, action_type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                <option value="CALL">Llamada Telefónica</option>
                <option value="VISIT">Visita Domiciliar</option>
                <option value="NOTICE">Notificación Escrita</option>
                <option value="SMS">SMS</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="AGREEMENT">Acuerdo de Pago</option>
                <option value="LEGAL">Acción Legal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Resultado</label>
              <select value={form.result} onChange={e => setForm(f => ({ ...f, result: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                <option value="">Sin resultado aún</option>
                <option value="CONTACT_MADE">Contacto Realizado</option>
                <option value="NO_CONTACT">Sin Contacto</option>
                <option value="PROMISE_TO_PAY">Promesa de Pago</option>
                <option value="REFUSED">Negativa de Pago</option>
                <option value="AGREEMENT_REACHED">Acuerdo Alcanzado</option>
                <option value="PARTIAL_PAYMENT">Pago Parcial</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notas *</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3} placeholder="Descripción de la gestión realizada..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Próx. Seguimiento</label>
              <input type="date" value={form.next_action_date}
                onChange={e => setForm(f => ({ ...f, next_action_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo Próx. Acción</label>
              <select value={form.next_action_type}
                onChange={e => setForm(f => ({ ...f, next_action_type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                <option value="">—</option>
                <option value="CALL">Llamada</option>
                <option value="VISIT">Visita</option>
                <option value="NOTICE">Notificación</option>
                <option value="LEGAL">Legal</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
            {saving ? 'Guardando...' : 'Registrar Acción'}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Nuevo Acuerdo ─────────────────────────────────────────────────────
function AgreementModal({ loanId, onClose, onSave }: {
  loanId: string; onClose: () => void; onSave: () => void
}) {
  const [form, setForm] = useState({ loan: loanId, agreed_amount: '', agreed_payment_date: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.agreed_amount || !form.agreed_payment_date) {
      toast.error('Completa monto y fecha'); return
    }
    setSaving(true)
    try {
      await api.post('/collections/agreements/', form)
      toast.success('Acuerdo registrado')
      onSave()
    } catch { toast.error('Error registrando acuerdo') } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Nuevo Acuerdo de Pago</h2>
          <button onClick={onClose}><XCircle className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Monto Acordado (RD$)</label>
            <input type="number" value={form.agreed_amount}
              onChange={e => setForm(f => ({ ...f, agreed_amount: e.target.value }))}
              placeholder="0.00" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha de Pago Acordada</label>
            <input type="date" value={form.agreed_payment_date}
              onChange={e => setForm(f => ({ ...f, agreed_payment_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notas</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none" />
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60">
            {saving ? 'Guardando...' : 'Registrar Acuerdo'}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function CollectionsPage() {
  const [tab, setTab]                 = useState('mora')
  const [overdueLoans, setOverdueLoans] = useState<OverdueLoan[]>([])
  const [actions, setActions]         = useState<CollectionAction[]>([])
  const [agreements, setAgreements]   = useState<Agreement[]>([])
  const [stats, setStats]             = useState<Stats | null>(null)
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [page, setPage]               = useState(1)
  const [totalPages, setTotalPages]   = useState(1)
  const [totalCount, setTotalCount]   = useState(0)
  const [actionModal, setActionModal] = useState<{ loanId: string; customerId: number } | null>(null)
  const [agreementModal, setAgreementModal] = useState<string | null>(null)

  const loadOverdue = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/collections/actions/overdue_loans/')
      setOverdueLoans(r.data.results || r.data)
      setTotalCount(r.data.count || (r.data.results || r.data).length)
    } catch { toast.error('Error cargando cartera en mora') } finally { setLoading(false) }
  }, [])

  const loadActions = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page }
      if (search) params.search = search
      const r = await api.get('/collections/actions/', { params })
      setActions(r.data.results || r.data)
      setTotalPages(r.data.total_pages || 1)
      setTotalCount(r.data.count || 0)
    } catch { toast.error('Error cargando acciones') } finally { setLoading(false) }
  }, [page, search])

  const loadAgreements = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/collections/agreements/')
      setAgreements(r.data.results || r.data)
      setTotalCount(r.data.count || 0)
    } catch { toast.error('Error cargando acuerdos') } finally { setLoading(false) }
  }, [])

  const loadStats = useCallback(async () => {
    try {
      const r = await api.get('/collections/actions/stats/')
      setStats(r.data)
    } catch {}
  }, [])

  useEffect(() => {
    loadStats()
    if (tab === 'mora')     loadOverdue()
    if (tab === 'acciones') loadActions()
    if (tab === 'acuerdos') loadAgreements()
  }, [tab, loadOverdue, loadActions, loadAgreements, loadStats])

  const handleAgreementStatus = async (id: number, action: 'mark_fulfilled' | 'mark_broken') => {
    try {
      await api.post(`/collections/agreements/${id}/${action}/`)
      toast.success(action === 'mark_fulfilled' ? 'Acuerdo marcado como cumplido' : 'Acuerdo marcado como incumplido')
      loadAgreements()
    } catch { toast.error('Error actualizando acuerdo') }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Cobranza y Mora</h1>
              <p className="text-xs text-gray-400">Gestión de cartera vencida y acuerdos de pago</p>
            </div>
          </div>
          <button onClick={() => { loadStats(); if (tab === 'mora') loadOverdue(); else if (tab === 'acciones') loadActions(); else loadAgreements() }}
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
            <RefreshCw className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        {/* KPIs rápidos */}
        {stats && (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
            {[
              { label: 'Total acciones', value: stats.total, color: 'text-gray-700' },
              { label: 'Este mes', value: stats.month_count, color: 'text-blue-600' },
              { label: 'Hoy', value: stats.today_count, color: 'text-indigo-600' },
              { label: 'Promesas', value: stats.promises, color: 'text-amber-600' },
              { label: 'Acuerdos', value: stats.agreements, color: 'text-emerald-600' },
              { label: 'Sin contacto', value: stats.no_contact, color: 'text-red-600' },
            ].map(k => (
              <div key={k.label} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className={`text-xl font-black ${k.color}`}>{k.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-0 -mb-4 border-b border-transparent">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => { setTab(t.id); setPage(1) }}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.id ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                <Icon className="h-3.5 w-3.5" />{t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* ── Tab: Cartera en Mora ──────────────────────────────────────── */}
        {tab === 'mora' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{totalCount} préstamos en mora</p>
            </div>
            {loading ? (
              <div className="flex justify-center py-20"><RefreshCw className="h-6 w-6 text-primary-500 animate-spin" /></div>
            ) : overdueLoans.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-30 text-emerald-500" />
                <p className="font-semibold text-emerald-600">¡Sin cartera en mora!</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        {['Préstamo', 'Cliente', 'Días mora', 'Saldo total', 'Producto', 'Oficial', 'Acciones'].map(h => (
                          <th key={h} className="text-left px-4 py-3 font-semibold text-gray-500 text-xs">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {overdueLoans.map(loan => {
                        const total = (loan.outstanding_principal || 0) + (loan.outstanding_interest || 0) + (loan.outstanding_late_fees || 0)
                        return (
                          <tr key={loan.id} className="hover:bg-red-50/30">
                            <td className="px-4 py-3 font-mono text-xs text-gray-600">{loan.loan_number}</td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">{loan.customer_name}</p>
                              <p className="text-xs text-gray-400">{loan.customer_code}</p>
                            </td>
                            <td className="px-4 py-3">
                              <MoraSemaforo days={loan.days_past_due} />
                            </td>
                            <td className="px-4 py-3 font-semibold text-red-700">{fmt(total)}</td>
                            <td className="px-4 py-3 text-xs text-gray-500">{loan.product_name}</td>
                            <td className="px-4 py-3 text-xs text-gray-500">{loan.officer_name || '—'}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => setActionModal({ loanId: loan.id, customerId: 0 })}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-xs font-medium hover:bg-blue-100">
                                  <Plus className="h-3 w-3" />Acción
                                </button>
                                <button
                                  onClick={() => setAgreementModal(loan.id)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-xs font-medium hover:bg-emerald-100">
                                  <HandshakeIcon className="h-3 w-3" />Acuerdo
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Acciones de Cobro ────────────────────────────────────── */}
        {tab === 'acciones' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-3 flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input placeholder="Buscar préstamo, cliente..." value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </div>
            </div>
            {loading ? (
              <div className="flex justify-center py-20"><RefreshCw className="h-6 w-6 text-primary-500 animate-spin" /></div>
            ) : actions.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Phone className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Sin acciones de cobro registradas</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        {['Acción', 'Préstamo', 'Cliente', 'Resultado', 'Mora al momento', 'Realizado por', 'Fecha'].map(h => (
                          <th key={h} className="text-left px-4 py-3 font-semibold text-gray-500 text-xs">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {actions.map(a => (
                        <tr key={a.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1.5 text-gray-700">
                              {ACTION_ICONS[a.action_type] || <Phone className="h-3.5 w-3.5" />}
                              <span className="text-xs font-medium">{a.action_type_display}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-600">{a.loan_number}</td>
                          <td className="px-4 py-3 text-gray-700">{a.customer_name}</td>
                          <td className="px-4 py-3">
                            {a.result_display ? (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                a.result === 'PROMISE_TO_PAY' || a.result === 'AGREEMENT_REACHED' ? 'bg-emerald-100 text-emerald-700' :
                                a.result === 'REFUSED' ? 'bg-red-100 text-red-700' :
                                a.result === 'NO_CONTACT' ? 'bg-gray-100 text-gray-600' :
                                'bg-blue-100 text-blue-700'
                              }`}>{a.result_display}</span>
                            ) : <span className="text-gray-400 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{a.days_past_due_at_action}d · {fmt(a.amount_owed_at_action)}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{a.performed_by_name}</td>
                          <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(a.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500">Página {page} de {totalPages}</p>
                    <div className="flex gap-2">
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Acuerdos de Pago ─────────────────────────────────────── */}
        {tab === 'acuerdos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{agreements.length} acuerdos registrados</p>
            </div>
            {loading ? (
              <div className="flex justify-center py-20"><RefreshCw className="h-6 w-6 text-primary-500 animate-spin" /></div>
            ) : agreements.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <HandshakeIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Sin acuerdos registrados</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Préstamo', 'Cliente', 'Monto acordado', 'Fecha pago', 'Estado', 'Notas', 'Acciones'].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-semibold text-gray-500 text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {agreements.map(a => (
                      <tr key={a.id} className={`hover:bg-gray-50 ${a.is_overdue ? 'bg-red-50/40' : ''}`}>
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">{a.loan_number}</td>
                        <td className="px-4 py-3 text-gray-700">{a.customer_name}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{fmt(a.agreed_amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs ${a.is_overdue ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                            {fmtDate(a.agreed_payment_date)}
                            {a.is_overdue && <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">Vencido</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            a.status === 'FULFILLED' ? 'bg-emerald-100 text-emerald-700' :
                            a.status === 'BROKEN' ? 'bg-red-100 text-red-700' :
                            a.status === 'CANCELLED' ? 'bg-gray-100 text-gray-500' :
                            'bg-blue-100 text-blue-700'
                          }`}>{a.status_display}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{a.notes || '—'}</td>
                        <td className="px-4 py-3">
                          {a.status === 'ACTIVE' && (
                            <div className="flex gap-1.5">
                              <button onClick={() => handleAgreementStatus(a.id, 'mark_fulfilled')}
                                title="Marcar como cumplido"
                                className="p-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-100">
                                <CheckCircle className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => handleAgreementStatus(a.id, 'mark_broken')}
                                title="Marcar como incumplido"
                                className="p-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100">
                                <XCircle className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {actionModal && (
        <ActionModal
          loanId={actionModal.loanId}
          customerId={actionModal.customerId}
          onClose={() => setActionModal(null)}
          onSave={() => { setActionModal(null); if (tab === 'acciones') loadActions() }}
        />
      )}
      {agreementModal && (
        <AgreementModal
          loanId={agreementModal}
          onClose={() => setAgreementModal(null)}
          onSave={() => { setAgreementModal(null); loadAgreements() }}
        />
      )}
    </div>
  )
}

// Necesario para que lucide-react compile HandshakeIcon
function HandshakeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"/>
      <path d="M12 5.36 8.87 8.5a2.13 2.13 0 0 0 0 3h0a2.13 2.13 0 0 0 3.02 0L12 11l.11.5a2.13 2.13 0 0 0 3.02 0h0a2.13 2.13 0 0 0 0-3z"/>
    </svg>
  )
}

