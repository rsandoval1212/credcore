import { useState, useEffect, useCallback } from 'react'
import { Vault, RefreshCw, Plus, CheckCircle, Clock, TrendingUp, TrendingDown, X, Save, PlusCircle } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/slices/authStore'
import AdminConfirmModal from '@/components/ui/AdminConfirmModal'

interface Session {
  id: number; register_name: string; cashier_name: string; status: string; status_display: string
  opening_amount: number; closing_amount: number; total_income: number; total_expense: number
  opened_at: string; closed_at: string; payments_total: number
}
interface Register { id: number; name: string; branch_name?: string; is_active?: boolean }
interface Stats { open_sessions: number; today_sessions: number; today_income: number; today_expense: number; month_income: number; month_expense: number }

const fmt = (n?: number | null) => n == null ? 'RD$0' : new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n)
const fmtDt = (d?: string) => !d ? '—' : new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function CashPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [registers, setRegisters] = useState<Register[]>([])
  const { user } = useAuthStore()
  const isAdmin = user?.is_superuser || user?.is_staff
  const [showOpen, setShowOpen] = useState(false)
  const [showClose, setShowClose] = useState<Session | null>(null)
  const [showNewRegister, setShowNewRegister] = useState(false)
  const [showAdminConfirm, setShowAdminConfirm] = useState<'close' | null>(null)
  const [newRegisterName, setNewRegisterName] = useState('')
  const [openForm, setOpenForm] = useState({ cash_register: '', opening_amount: '0' })
  const [closeForm, setCloseForm] = useState({ closing_amount: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, st, r] = await Promise.all([
        api.get('/cash/sessions/'),
        api.get('/cash/sessions/stats/'),
        api.get('/cash/registers/'),
      ])
      setSessions(s.data.results || s.data)
      setStats(st.data)
      const regs = r.data.results || r.data
      setRegisters(regs)
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreateRegister = async () => {
    if (!newRegisterName.trim()) { toast.error('Ingresa un nombre para la caja'); return }
    setSaving(true)
    try {
      // La sucursal se asigna automáticamente en el backend (versión escritorio)
      const res = await api.post('/cash/registers/', { name: newRegisterName.trim(), currency: 'DOP', is_active: true })
      toast.success(`Caja "${res.data.name}" creada`)
      setNewRegisterName('')
      setShowNewRegister(false)
      // Reload registers and auto-select the new one
      const r = await api.get('/cash/registers/')
      const regs = r.data.results || r.data
      setRegisters(regs)
      setOpenForm(f => ({ ...f, cash_register: String(res.data.id) }))
    } catch (err: any) {
      const detail = err?.response?.data?.name?.[0] || err?.response?.data?.detail || 'Error creando caja'
      toast.error(detail)
    } finally { setSaving(false) }
  }

  const handleOpen = async () => {
    if (!openForm.cash_register) { toast.error('Selecciona una caja'); return }
    setSaving(true)
    try {
      await api.post('/cash/sessions/', { cash_register: parseInt(openForm.cash_register), opening_amount: parseFloat(openForm.opening_amount) || 0 })
      toast.success('Sesión abierta'); setShowOpen(false); load()
    } catch { toast.error('Error abriendo sesión') } finally { setSaving(false) }
  }

  const doClose = async () => {
    if (!showClose) return
    setSaving(true)
    try {
      await api.post(`/cash/sessions/${showClose.id}/close_session/`, { closing_amount: parseFloat(closeForm.closing_amount) || 0, notes: closeForm.notes })
      toast.success('Sesión cerrada'); setShowClose(null); setCloseForm({ closing_amount: '', notes: '' }); load()
    } catch { toast.error('Error cerrando sesión') } finally { setSaving(false) }
  }

  const handleClose = () => {
    if (!isAdmin) {
      setShowAdminConfirm('close')
      return
    }
    doClose()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Caja</h1><p className="text-sm text-gray-500 mt-1">Gestión de sesiones de caja</p></div>
        <button onClick={() => setShowOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"><Plus className="h-4 w-4" /> Abrir Sesión</button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Sesiones Abiertas" value={String(stats.open_sessions)} sub="ahora mismo" color="blue" icon={<Clock className="h-5 w-5 text-blue-600" />} />
          <StatCard label="Ingresos Hoy" value={fmt(stats.today_income)} sub={`${stats.today_sessions} sesiones`} color="emerald" icon={<TrendingUp className="h-5 w-5 text-emerald-600" />} />
          <StatCard label="Egresos Hoy" value={fmt(stats.today_expense)} sub="gastos operativos" color="red" icon={<TrendingDown className="h-5 w-5 text-red-600" />} />
          <StatCard label="Ingresos Mes" value={fmt(stats.month_income)} sub="acumulado del mes" color="purple" icon={<TrendingUp className="h-5 w-5 text-purple-600" />} />
          <StatCard label="Balance Hoy" value={fmt(stats.today_income - stats.today_expense)} sub="ingresos - egresos" color="amber" icon={<Vault className="h-5 w-5 text-amber-600" />} />
        </div>
      )}

      {/* Open session modal */}
      {showOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between"><h3 className="font-bold text-lg">Abrir Sesión de Caja</h3><button onClick={() => setShowOpen(false)}><X className="h-5 w-5 text-gray-400" /></button></div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Caja *</label>
              <div className="flex gap-2">
                <select value={openForm.cash_register} onChange={e => setOpenForm(f => ({ ...f, cash_register: e.target.value }))} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="">Seleccionar...</option>
                  {registers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <button type="button" onClick={() => setShowNewRegister(true)} className="px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 text-sm font-medium flex items-center gap-1" title="Crear nueva caja">
                  <PlusCircle className="h-4 w-4" /> Nueva
                </button>
              </div>
              {registers.length === 0 && !showNewRegister && (
                <p className="text-xs text-amber-600 mt-1">No hay cajas registradas. Crea una nueva para continuar.</p>
              )}
            </div>
            {showNewRegister && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
                <label className="block text-xs font-semibold text-emerald-700">Nombre de la nueva caja</label>
                <div className="flex gap-2">
                  <input type="text" value={newRegisterName} onChange={e => setNewRegisterName(e.target.value)} placeholder="Ej: Caja Principal, Caja 1..." className="flex-1 px-3 py-2 border border-emerald-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" autoFocus onKeyDown={e => e.key === 'Enter' && handleCreateRegister()} />
                  <button onClick={handleCreateRegister} disabled={saving} className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:opacity-60">Crear</button>
                  <button onClick={() => { setShowNewRegister(false); setNewRegisterName('') }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Monto de apertura (RD$)</label>
              <input type="number" min="0" value={openForm.opening_amount} onChange={e => setOpenForm(f => ({ ...f, opening_amount: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowOpen(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={handleOpen} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60">
                <Save className="h-4 w-4" />{saving ? 'Abriendo...' : 'Abrir Sesión'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close session modal */}
      {showClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between"><h3 className="font-bold text-lg">Cerrar Sesión</h3><button onClick={() => setShowClose(null)}><X className="h-5 w-5 text-gray-400" /></button></div>
            <div className="bg-gray-50 rounded-xl p-3 text-sm">
              <p className="text-gray-600">Ingresos del día: <span className="font-bold text-emerald-600">{fmt(showClose.total_income)}</span></p>
              <p className="text-gray-600">Cobros de préstamos: <span className="font-bold">{fmt(showClose.payments_total)}</span></p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Efectivo en caja (RD$) *</label>
              <input type="number" min="0" value={closeForm.closing_amount} onChange={e => setCloseForm(f => ({ ...f, closing_amount: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Conteo físico de caja" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Notas de cierre</label>
              <textarea value={closeForm.notes} onChange={e => setCloseForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowClose(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={handleClose} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60">
                <CheckCircle className="h-4 w-4" />{saving ? 'Cerrando...' : 'Cerrar Sesión'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sessions table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-700">Sesiones de Caja</h3>
          <button onClick={load} className="p-1.5 rounded-lg hover:bg-gray-50"><RefreshCw className="h-4 w-4 text-gray-400" /></button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16"><RefreshCw className="h-6 w-6 text-primary-500 animate-spin" /></div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16 text-gray-400"><Vault className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>Sin sesiones registradas</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-gray-100">
                {['Caja', 'Cajero', 'Estado', 'Apertura', 'Cobros', 'Ingresos', 'Egresos', 'Abierta', 'Cerrada', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {sessions.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.register_name}</td>
                    <td className="px-4 py-3 text-gray-600">{s.cashier_name}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.status === 'OPEN' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{s.status_display}</span></td>
                    <td className="px-4 py-3 text-right">{fmt(s.opening_amount)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">{fmt(s.payments_total)}</td>
                    <td className="px-4 py-3 text-right">{fmt(s.total_income)}</td>
                    <td className="px-4 py-3 text-right text-red-500">{fmt(s.total_expense)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{fmtDt(s.opened_at)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{fmtDt(s.closed_at)}</td>
                    <td className="px-4 py-3">
                      {s.status === 'OPEN' && (
                        <button onClick={() => setShowClose(s)} className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200">Cerrar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdminConfirm === 'close' && (
        <AdminConfirmModal
          action={`Cerrar sesión de caja: ${showClose?.register_name || ''}`}
          onConfirmed={() => { setShowAdminConfirm(null); doClose() }}
          onClose={() => setShowAdminConfirm(null)}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, sub, color, icon }: { label: string; value: string; sub: string; color: string; icon: React.ReactNode }) {
  const c: Record<string, string> = { blue: 'bg-blue-50 border-blue-100', emerald: 'bg-emerald-50 border-emerald-100', red: 'bg-red-50 border-red-100', purple: 'bg-purple-50 border-purple-100', amber: 'bg-amber-50 border-amber-100' }
  return (
    <div className={`rounded-xl border p-4 ${c[color] || 'bg-gray-50 border-gray-100'}`}>
      <div className="flex items-center gap-2 mb-2 text-gray-500">{icon}<p className="text-xs font-medium">{label}</p></div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}
