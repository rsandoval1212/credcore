import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, RefreshCw, CreditCard, User, Calendar,
  TrendingUp, AlertTriangle, CheckCircle, Clock,
  FileText, DollarSign, Activity, Banknote, XCircle,
  MessageCircle, BarChart3, ShieldOff, Percent,
} from 'lucide-react'
import { extractApiError } from '@/utils/apiError'
import { loansService } from '@/services/loans'
import { documentsService, type RecurrenceAnalysis } from '@/services/company'
import { notificationsService } from '@/services/notifications'
import type { Loan, LoanScheduleItem } from '@/types'
import toast from 'react-hot-toast'
import api from '@/services/api'
import AdminConfirmModal from '@/components/ui/AdminConfirmModal'
import ExportButton from '@/components/ui/ExportButton'
import DropdownMenu from '@/components/ui/DropdownMenu'
import SignaturePad from '@/components/ui/SignaturePad'
import { useAuthStore } from '@/store/slices/authStore'

const TABS = [
  { id: 'resumen',    label: 'Resumen',    icon: Activity },
  { id: 'cliente',   label: 'Cliente',    icon: User },
  { id: 'tabla',     label: 'Amortización', icon: Calendar },
  { id: 'pagos',     label: 'Pagos',      icon: DollarSign },
  { id: 'recurrencia', label: 'Recurrencia', icon: BarChart3 },
]

const STATUS_META: Record<string, { label: string; color: string }> = {
  ACTIVE:      { label: 'Activo',       color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  COMPLETED:   { label: 'Completado',   color: 'bg-blue-100 text-blue-700 border-blue-200' },
  DEFAULTED:   { label: 'En Mora',      color: 'bg-red-100 text-red-700 border-red-200' },
  WRITTEN_OFF: { label: 'Castigado',    color: 'bg-gray-200 text-gray-600 border-gray-300' },
  CANCELLED:   { label: 'Cancelado',    color: 'bg-gray-100 text-gray-500 border-gray-200' },
  REFINANCED:  { label: 'Refinanciado', color: 'bg-purple-100 text-purple-700 border-purple-200' },
}

const SCHEDULE_COLORS: Record<string, string> = {
  PAID:    'bg-emerald-50 text-emerald-700',
  PARTIAL: 'bg-amber-50 text-amber-700',
  OVERDUE: 'bg-red-50 text-red-700',
  PENDING: 'bg-gray-50 text-gray-600',
  WAIVED:  'bg-blue-50 text-blue-600',
}

function fmt(n?: number | null) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n)
}
function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
}
function pct(a: number, b: number) {
  if (!b) return '0%'
  return `${Math.min(100, Math.round((a / b) * 100))}%`
}

export default function LoanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loan, setLoan] = useState<Loan | null>(null)
  const [schedule, setSchedule] = useState<LoanScheduleItem[]>([])
  const [payments, setPayments] = useState<unknown[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('resumen')
  const [showWriteOff, setShowWriteOff]   = useState(false)
  const [showRenegotiate, setShowRenegotiate] = useState(false)
  const [renegTerm, setRenegTerm] = useState('')
  const [renegCuota, setRenegCuota] = useState('')
  const [renegReason, setRenegReason] = useState('')
  const [writeOffReason, setWriteOffReason] = useState('')
  const [actionLoading, setActionLoading]   = useState(false)
  const [recurrence, setRecurrence]         = useState<RecurrenceAnalysis | null>(null)
  const [sharing, setSharing]               = useState<'' | 'amort' | 'statement'>('')
  // Firma digital
  const [showSignature, setShowSignature]   = useState(false)
  // Mora
  const [showMora, setShowMora]             = useState(false)
  const [moraAction, setMoraAction]         = useState<'waive' | 'rate' | 'add'>('waive')
  const [moraAmount, setMoraAmount]         = useState('')
  const [moraRate, setMoraRate]             = useState('')
  const [moraReason, setMoraReason]         = useState('')
  const [pendingMoraFn, setPendingMoraFn]   = useState<(() => void) | null>(null)
  const { user: currentUser }               = useAuthStore()
  const isAdmin = !!(currentUser as unknown as { is_superuser?: boolean })?.is_superuser ||
                  currentUser?.email === 'admin@credcore.local'

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const r = await loansService.get(id)
      setLoan(r.data)
      if (r.data.schedule) setSchedule(r.data.schedule)
    } catch {
      toast.error('Error cargando préstamo')
    } finally {
      setLoading(false)
    }
  }, [id])

  const loadSchedule = useCallback(async () => {
    if (!id) return
    try {
      const r = await loansService.getSchedule(id)
      setSchedule(r.data)
    } catch {}
  }, [id])

  const loadPayments = useCallback(async () => {
    if (!id) return
    try {
      const r = await loansService.getPayments(id)
      setPayments(r.data)
    } catch {}
  }, [id])

  const loadRecurrence = useCallback(async () => {
    if (!id) return
    try {
      const r = await documentsService.getRecurrence(id)
      setRecurrence(r.data)
    } catch {}
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (tab === 'tabla' && schedule.length === 0) loadSchedule() }, [tab, loadSchedule, schedule.length])
  useEffect(() => { if (tab === 'pagos') loadPayments() }, [tab, loadPayments])
  useEffect(() => { if (tab === 'recurrencia' && !recurrence) loadRecurrence() }, [tab, loadRecurrence, recurrence])

  const handleShareAmortization = async () => {
    if (!id) return
    setSharing('amort')
    try {
      const r = await documentsService.shareAmortization(id)
      if (!r.data.wa_url) { toast.error('Cliente sin teléfono'); return }
      notificationsService.openWhatsApp(r.data.wa_url)
      toast.success('Tabla enviada por WhatsApp', { icon: '📋' })
    } catch { toast.error('Error generando tabla') } finally { setSharing('') }
  }

  const handleShareStatement = async () => {
    if (!id) return
    setSharing('statement')
    try {
      const r = await documentsService.shareStatement(id)
      if (!r.data.wa_url) { toast.error('Cliente sin teléfono'); return }
      notificationsService.openWhatsApp(r.data.wa_url)
      toast.success('Estado de cuenta enviado por WhatsApp', { icon: '📊' })
    } catch { toast.error('Error generando estado') } finally { setSharing('') }
  }

  const handleWriteOff = async () => {
    if (!id || !writeOffReason.trim()) { toast.error('Indica el motivo'); return }
    setActionLoading(true)
    try {
      await loansService.writeOff(id, writeOffReason)
      toast.success('Préstamo castigado')
      setShowWriteOff(false)
      load()
    } catch (e: unknown) {
      toast.error(extractApiError(e, 'Error al castigar préstamo'))
    } finally {
      setActionLoading(false)
    }
  }

  // Renegociar préstamo
  const handleRenegotiate = async () => {
    if (!id) return
    const term = parseInt(renegTerm)
    const cuota = parseFloat(renegCuota)
    if (!term || term < 1) { toast.error('Plazo inválido'); return }
    if (!cuota || cuota <= 0) { toast.error('Cuota inválida'); return }
    setActionLoading(true)
    try {
      await api.post(`/loans/${id}/renegotiate/`, {
        new_term_months: term, new_monthly_payment: cuota,
        reason: renegReason || 'Renegociación solicitada',
      })
      toast.success('Préstamo renegociado y tabla regenerada', { icon: '✅' })
      setShowRenegotiate(false); setRenegReason('')
      load()
    } catch (e) {
      toast.error(extractApiError(e, 'Error renegociando'))
    } finally { setActionLoading(false) }
  }

  // ── Condonar / ajustar mora ──────────────────────────────────────────────────
  const executeMora = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      if (moraAction === 'waive') {
        const r = await api.post(`/loans/${id}/waive_late_fees/`, {
          amount: moraAmount ? parseFloat(moraAmount) : undefined,
          reason: moraReason || 'Gracia otorgada por administrador',
        })
        toast.success(r.data.detail, { icon: '✅' })
      } else if (moraAction === 'add') {
        if (!moraAmount || parseFloat(moraAmount) <= 0) { toast.error('Ingresa un monto'); return }
        await api.post(`/loans/${id}/add-late-fee/`, {
          amount: parseFloat(moraAmount),
          reason: moraReason || 'Mora aplicada manualmente',
        })
        toast.success(`Mora de RD$${moraAmount} agregada`, { icon: '⚠️' })
      } else {
        const r = await api.post(`/loans/${id}/adjust_late_fee_rate/`, {
          new_rate: parseFloat(moraRate),
          reason: moraReason || 'Ajuste de tasa',
        })
        toast.success(r.data.detail, { icon: '✅' })
      }
      setShowMora(false); setMoraAmount(''); setMoraRate(''); setMoraReason('')
      load()
    } catch (e) {
      toast.error(extractApiError(e, 'Error actualizando mora'))
    } finally { setActionLoading(false) }
  }

  const handleMora = (action: 'waive' | 'rate' | 'add') => {
    setMoraAction(action)
    setShowMora(true)
    if (!isAdmin) {
      // Solicitar autorización admin
      setPendingMoraFn(() => executeMora)
    }
  }

  const handleGenSchedule = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      const r = await loansService.generateSchedule(id)
      setSchedule(r.data as LoanScheduleItem[])
      toast.success('Tabla generada')
    } catch (e: unknown) {
      toast.error(extractApiError(e, 'Ya existe tabla de amortización'))
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <RefreshCw className="h-6 w-6 text-primary-500 animate-spin" />
    </div>
  )
  if (!loan) return <div className="p-6 text-center text-gray-400">Préstamo no encontrado</div>

  const meta = STATUS_META[loan.status] || { label: loan.status, color: 'bg-gray-100 text-gray-600' }
  const totalOutstanding = (loan.outstanding_principal || 0) + (loan.outstanding_interest || 0) + (loan.outstanding_late_fees || 0)
  const progress = (loan.installments_paid || 0) + (loan.installments_remaining || 0) > 0
    ? ((loan.installments_paid || 0) / ((loan.installments_paid || 0) + (loan.installments_remaining || 0))) * 100
    : 0

  const customer = typeof loan.customer === 'object' ? loan.customer : null
  const customerName = loan.customer_name || (customer ? (customer as { full_name?: string }).full_name : '—')

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/loans')} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </button>
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center shrink-0">
              <CreditCard className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900">{loan.loan_number}</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${meta.color}`}>{meta.label}</span>
                {loan.days_past_due > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                    {loan.days_past_due} días mora
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400">{customerName} · {loan.product_name}</p>
            </div>
          </div>

          {/* Acciones — compactas: iconos con tooltip + dropdown para acciones avanzadas */}
          <div className="flex gap-1.5 flex-wrap items-center">
            {/* Grupo PDFs */}
            <ExportButton
              endpoint={`/api/v1/reports/pdf/contract/${id}/`}
              label="Contrato"
              variant="outline"
              className="text-xs px-2.5 py-1.5 border-blue-200 text-blue-700 hover:bg-blue-50"
            />
            <ExportButton
              endpoint={`/api/v1/reports/pdf/amortization/${id}/`}
              label="Tabla"
              variant="outline"
              className="text-xs px-2.5 py-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            />
            <ExportButton
              endpoint={`/api/v1/reports/pdf/statement/${id}/`}
              label="Estado"
              variant="outline"
              className="text-xs px-2.5 py-1.5 border-purple-200 text-purple-700 hover:bg-purple-50"
            />

            {/* Grupo WhatsApp en un dropdown */}
            <DropdownMenu
              align="right"
              buttonClassName="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-green-50 border border-green-200 text-green-700 rounded-lg hover:bg-green-100"
              trigger={<><MessageCircle className="h-3.5 w-3.5" /><span>WhatsApp</span><svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg></>}
              items={[
                { label: sharing === 'amort' ? 'Generando tabla...' : 'Enviar tabla de amortización', icon: <MessageCircle className="h-4 w-4" />, onClick: handleShareAmortization, disabled: sharing === 'amort' },
                { label: sharing === 'statement' ? 'Generando estado...' : 'Enviar estado de cuenta', icon: <MessageCircle className="h-4 w-4" />, onClick: handleShareStatement, disabled: sharing === 'statement' },
              ]}
            />

            {/* Acciones admin agrupadas en dropdown */}
            {(loan.status === 'ACTIVE' || loan.status === 'DEFAULTED') && (
              <DropdownMenu
                align="right"
                buttonClassName="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-lg hover:bg-amber-100"
                trigger={<><AlertTriangle className="h-3.5 w-3.5" /><span>Mora</span><svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg></>}
                items={[
                  ...(isAdmin ? [{ label: 'Agregar mora manual', icon: <AlertTriangle className="h-4 w-4" />, onClick: () => handleMora('add'), variant: 'danger' as const }] : []),
                  { label: 'Ajustar tasa de mora', icon: <Percent className="h-4 w-4" />, onClick: () => handleMora('rate') },
                  ...(loan.outstanding_late_fees > 0 ? [{ label: 'Condonar mora', icon: <ShieldOff className="h-4 w-4" />, onClick: () => handleMora('waive'), divider: true }] : []),
                ]}
              />
            )}

            {/* Firma + Renegociar + Castigar también compactos */}
            {!(loan as unknown as Record<string, unknown>).client_signature && (
              <button onClick={() => setShowSignature(true)} title="Captura de firma del cliente"
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-pink-200 text-pink-700 bg-pink-50 rounded-lg hover:bg-pink-100">
                ✍️ <span className="hidden sm:inline">Firmar</span>
              </button>
            )}
            {(loan.status === 'ACTIVE' || loan.status === 'DEFAULTED') && isAdmin && (
              <button onClick={() => { setShowRenegotiate(true); setRenegTerm(String(loan.term_months)); setRenegCuota(String(loan.monthly_payment)) }}
                title="Renegociar plazo y cuota"
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-purple-200 text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100">
                <RefreshCw className="h-3.5 w-3.5" /><span className="hidden sm:inline">Renegociar</span>
              </button>
            )}
            {(loan.status === 'ACTIVE' || loan.status === 'DEFAULTED') && (
              <button onClick={() => setShowWriteOff(v => !v)} title="Castigar préstamo (pérdida)"
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                <XCircle className="h-3.5 w-3.5" /><span className="hidden sm:inline">Castigar</span>
              </button>
            )}
            <button onClick={load} title="Actualizar"
              className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
              <RefreshCw className="h-3.5 w-3.5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Write-off form */}
        {showWriteOff && (
          <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3 items-center">
            <input value={writeOffReason} onChange={e => setWriteOffReason(e.target.value)}
              placeholder="Motivo del castigo..." className="flex-1 px-3 py-2 border border-red-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
            <button onClick={handleWriteOff} disabled={actionLoading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-60">
              {actionLoading ? 'Procesando...' : 'Confirmar'}
            </button>
            <button onClick={() => setShowWriteOff(false)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-white">Cancelar</button>
          </div>
        )}

        {/* Panel de renegociación */}
        {showRenegotiate && (
          <div className="mt-3 p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-3">
            <div>
              <p className="text-sm font-semibold text-purple-900">🔄 Renegociar préstamo</p>
              <p className="text-xs text-purple-700 mt-1">
                Las cuotas pagadas se conservan. Las pendientes se regeneran con los nuevos términos.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-purple-900">Nuevo plazo (meses)</label>
                <input type="number" min="1" value={renegTerm} onChange={e => setRenegTerm(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-purple-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-purple-900">Nueva cuota mensual (RD$)</label>
                <input type="number" min="0" step="0.01" value={renegCuota} onChange={e => setRenegCuota(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-purple-200 rounded-lg text-sm" />
              </div>
            </div>
            <input value={renegReason} onChange={e => setRenegReason(e.target.value)}
              placeholder="Motivo de la renegociación (ej: cliente solicita extender el plazo)"
              className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm" />
            <div className="flex gap-2">
              <button onClick={handleRenegotiate} disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-60">
                {actionLoading ? 'Procesando...' : 'Confirmar renegociación'}
              </button>
              <button onClick={() => setShowRenegotiate(false)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-white">Cancelar</button>
            </div>
          </div>
        )}

        {/* Panel de mora */}
        {showMora && (
          <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
            <p className="text-sm font-semibold text-amber-800">
              {moraAction === 'waive' ? '🛡️ Condonar mora' : moraAction === 'add' ? '⚠️ Agregar mora manualmente' : '📊 Ajustar tasa de mora'}
            </p>
            <div className="flex gap-3 flex-wrap">
              {(moraAction === 'waive' || moraAction === 'add') ? (
                <input value={moraAmount} onChange={e => setMoraAmount(e.target.value)}
                  type="number" min="0" placeholder={moraAction === 'add' ? 'Monto de mora a agregar' : 'Monto a condonar (vacío = todo)'}
                  className="flex-1 min-w-[160px] px-3 py-2 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white" />
              ) : (
                <input value={moraRate} onChange={e => setMoraRate(e.target.value)}
                  type="number" min="0" max="100" step="0.01" placeholder="Nueva tasa % (ej: 0.5)"
                  className="flex-1 min-w-[160px] px-3 py-2 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white" />
              )}
              <input value={moraReason} onChange={e => setMoraReason(e.target.value)}
                placeholder="Motivo (opcional)"
                className="flex-1 min-w-[160px] px-3 py-2 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white" />
              <button onClick={isAdmin ? executeMora : () => setPendingMoraFn(() => executeMora)}
                disabled={actionLoading}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-60">
                {actionLoading ? 'Aplicando...' : 'Aplicar'}
              </button>
              <button onClick={() => { setShowMora(false); setPendingMoraFn(null) }}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-white">Cancelar</button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-0 mt-3 border-b border-transparent -mb-4">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <Icon className="h-3.5 w-3.5" />{t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'resumen'  && <TabResumen loan={loan} totalOutstanding={totalOutstanding} progress={progress} />}
        {tab === 'cliente'  && <TabCliente loan={loan} />}
        {tab === 'tabla'    && <TabTabla schedule={schedule} loan={loan} onGenerate={handleGenSchedule} generating={actionLoading} />}
        {tab === 'pagos'    && <TabPagos payments={payments} />}
        {tab === 'recurrencia' && <TabRecurrencia data={recurrence} onReload={loadRecurrence} />}
      </div>

      {/* Modal autorización admin para mora */}
      {pendingMoraFn && (
        <AdminConfirmModal
          action={moraAction === 'waive'
            ? `Condonar mora${moraAmount ? ` de RD$${moraAmount}` : ' completa'} del préstamo ${loan.loan_number}`
            : `Ajustar tasa de mora a ${moraRate}% en préstamo ${loan.loan_number}`}
          onConfirmed={() => { pendingMoraFn(); setPendingMoraFn(null) }}
          onClose={() => setPendingMoraFn(null)}
        />
      )}

      {/* Firma digital */}
      {showSignature && (
        <SignaturePad
          onSave={async (sig) => {
            try {
              await api.post(`/loans/${id}/sign/`, { signature: sig })
              toast.success('Firma registrada exitosamente')
              setShowSignature(false)
              load()
            } catch { toast.error('Error guardando firma') }
          }}
          onCancel={() => setShowSignature(false)}
        />
      )}
    </div>
  )
}

// ── Tab: Resumen ──────────────────────────────────────────────────────────────
function TabResumen({ loan, totalOutstanding, progress }: { loan: Loan; totalOutstanding: number; progress: number }) {
  return (
    <div className="space-y-5">
      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniKPI label="Capital original" value={fmt(loan.principal_amount)} color="blue" icon={<Banknote className="h-4 w-4" />} />
        <MiniKPI label="Saldo pendiente" value={fmt(totalOutstanding)} color={totalOutstanding > 0 ? 'amber' : 'green'} icon={<TrendingUp className="h-4 w-4" />} />
        <MiniKPI label="Total pagado" value={fmt(loan.total_paid)} color="green" icon={<CheckCircle className="h-4 w-4" />} />
        <MiniKPI label="Cuota mensual" value={fmt(loan.monthly_payment)} color="purple" icon={<Calendar className="h-4 w-4" />} />
      </div>

      {/* Barra de progreso */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">Progreso del Préstamo</p>
          <span className="text-sm font-bold text-primary-600">{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-2">
          <span>{loan.installments_paid} cuotas pagadas</span>
          <span>{loan.installments_remaining} cuotas restantes</span>
        </div>
      </div>

      {/* Desglose saldos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Saldos Pendientes" icon={<DollarSign className="h-4 w-4" />}>
          <div className="space-y-3">
            <BalanceRow label="Capital" amount={loan.outstanding_principal} />
            <BalanceRow label="Intereses" amount={loan.outstanding_interest} />
            {loan.outstanding_late_fees > 0 && (
              <BalanceRow label="Intereses moratorios" amount={loan.outstanding_late_fees} danger />
            )}
            <div className="pt-2 border-t border-gray-100">
              <BalanceRow label="TOTAL" amount={totalOutstanding} bold />
            </div>
          </div>
        </Section>

        <Section title="Condiciones del Préstamo" icon={<FileText className="h-4 w-4" />}>
          <div className="space-y-2 text-sm">
            <InfoRow label="Tasa anual" value={`${loan.annual_interest_rate}%`} />
            <InfoRow label="Plazo" value={`${loan.term_months} meses`} />
            <InfoRow label="Método de pago" value={loan.payment_method_display || loan.payment_method} />
            <InfoRow label="Tasa mora" value={`${loan.late_fee_rate}% diario`} />
            <InfoRow label="Total a pagar" value={fmt(loan.total_to_pay)} />
            <InfoRow label="Total intereses" value={fmt(loan.total_interest)} />
          </div>
        </Section>
      </div>

      {/* Fechas */}
      <Section title="Fechas Clave" icon={<Calendar className="h-4 w-4" />}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <InfoItem label="Desembolso" value={fmtDate(loan.disbursement_date)} />
          <InfoItem label="Primer pago" value={fmtDate(loan.first_payment_date)} />
          <InfoItem label="Vencimiento" value={fmtDate(loan.maturity_date)} />
          <InfoItem label="Último pago" value={fmtDate(loan.last_payment_date)} />
        </div>
      </Section>

      {/* Próximo pago */}
      {loan.next_payment && (
        <div className={`rounded-xl border p-4 ${loan.next_payment.is_overdue ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-100'}`}>
          <div className="flex items-center gap-2 mb-2">
            {loan.next_payment.is_overdue
              ? <AlertTriangle className="h-4 w-4 text-red-600" />
              : <Clock className="h-4 w-4 text-blue-600" />}
            <p className={`text-sm font-semibold ${loan.next_payment.is_overdue ? 'text-red-700' : 'text-blue-700'}`}>
              {loan.next_payment.is_overdue ? 'Cuota Vencida' : 'Próximo Pago'}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500">Cuota #</p>
              <p className="font-semibold">{loan.next_payment.installment_number}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Fecha</p>
              <p className="font-semibold">{fmtDate(loan.next_payment.due_date)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Monto</p>
              <p className="font-semibold">{fmt(loan.next_payment.total_amount - loan.next_payment.total_paid)}</p>
            </div>
          </div>
        </div>
      )}

      {loan.notes && (
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 mb-1">Notas</p>
          <p className="text-sm text-gray-700">{loan.notes}</p>
        </div>
      )}
    </div>
  )
}

// ── Tab: Cliente ──────────────────────────────────────────────────────────────
function TabCliente({ loan }: { loan: Loan }) {
  const customer = typeof loan.customer === 'object' ? loan.customer as unknown as Record<string, unknown> : null

  return (
    <div className="space-y-4">
      <Section title="Datos del Cliente" icon={<User className="h-4 w-4" />}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <InfoItem label="Nombre" value={loan.customer_name || String(customer?.full_name || '—')} />
          <InfoItem label="Código" value={loan.customer_code || String(customer?.customer_code || '—')} />
          <InfoItem label="Sucursal" value={loan.branch_name || '—'} />
          <InfoItem label="Oficial" value={loan.officer_name || '—'} />
        </div>
      </Section>
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
        Para ver el expediente completo del cliente, navega desde el módulo de Clientes.
      </div>
    </div>
  )
}

// ── Tab: Tabla de amortización ────────────────────────────────────────────────
function formatWaPhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits
  if (digits.length === 10) return '1' + digits
  if (digits.length === 7) return '1809' + digits
  return digits
}

function TabTabla({ schedule, loan, onGenerate, generating }: {
  schedule: LoanScheduleItem[]; loan: Loan; onGenerate: () => void; generating: boolean
}) {
  if (schedule.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Sin tabla de amortización</p>
        <button onClick={onGenerate} disabled={generating}
          className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-60">
          {generating ? 'Generando...' : 'Generar Tabla'}
        </button>
      </div>
    )
  }

  const paid = schedule.filter(s => s.status === 'PAID').length
  const overdue = schedule.filter(s => s.is_overdue).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm">
          <span className="text-emerald-600 font-medium">{paid} pagadas</span>
          {overdue > 0 && <span className="text-red-600 font-medium">{overdue} vencidas</span>}
          <span className="text-gray-400">{schedule.length - paid - overdue} pendientes</span>
        </div>
        <p className="text-xs text-gray-400">{loan.term_months} cuotas · {loan.annual_interest_rate}% anual</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-center px-3 py-2.5 font-semibold text-gray-600 w-12">#</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-600">Vencimiento</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-600">Capital</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-600">Interés</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-600">Cuota</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-600">Pagado</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-600">Saldo</th>
                <th className="text-center px-3 py-2.5 font-semibold text-gray-600">Estado</th>
                <th className="px-3 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {schedule.map(item => {
                const isOver = item.is_overdue
                const canRemind = item.status !== 'PAID' && item.status !== 'WAIVED'
                const cd = loan.customer_data || (typeof loan.customer === 'object' ? loan.customer : null)
                const custPhone = (cd as Record<string, string> | null)?.whatsapp
                  || (cd as Record<string, string> | null)?.phone1
                  || ''
                const remaining = item.total_amount - (item.total_paid || 0)
                const waMsg = isOver
                  ? `Estimado/a ${loan.customer_name}, le recordamos que la cuota #${item.installment_number} de su préstamo ${loan.loan_number} por ${fmt(remaining)} venció el ${fmtDate(item.due_date)}. Por favor comuníquese con nosotros a la brevedad.`
                  : `Estimado/a ${loan.customer_name}, le recordamos que su cuota #${item.installment_number} del préstamo ${loan.loan_number} por ${fmt(remaining)} vence el ${fmtDate(item.due_date)}. ¡Gracias!`
                const waUrl = custPhone
                  ? `https://wa.me/${formatWaPhone(custPhone)}?text=${encodeURIComponent(waMsg)}`
                  : ''
                return (
                  <tr key={item.id} className={`${item.status === 'PAID' ? 'opacity-60' : ''} ${isOver ? 'bg-red-50/50' : 'hover:bg-gray-50'}`}>
                    <td className="px-3 py-2.5 text-center text-gray-400 text-xs">{item.installment_number}</td>
                    <td className="px-3 py-2.5 text-gray-600">{fmtDate(item.due_date)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">{fmt(item.principal_amount)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">{fmt(item.interest_amount)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{fmt(item.total_amount)}</td>
                    <td className="px-3 py-2.5 text-right text-emerald-600">{item.total_paid > 0 ? fmt(item.total_paid) : '—'}</td>
                    <td className="px-3 py-2.5 text-right text-gray-500">{fmt(item.balance_after)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SCHEDULE_COLORS[isOver ? 'OVERDUE' : item.status] || 'bg-gray-50 text-gray-600'}`}>
                        {isOver ? 'Vencida' : item.status === 'PAID' ? 'Pagada' : item.status === 'PARTIAL' ? 'Parcial' : item.status === 'WAIVED' ? 'Condonada' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {canRemind && waUrl ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); window.open(waUrl, '_blank', 'noopener,noreferrer') }}
                          title={isOver ? 'Cobrar por WhatsApp' : 'Recordar por WhatsApp'}
                          className={`p-1.5 rounded-lg transition-colors ${isOver ? 'hover:bg-red-100 text-red-500' : 'hover:bg-green-50 text-green-600'}`}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={2} className="px-3 py-2.5 text-xs font-bold text-gray-600">TOTALES</td>
                <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-700">{fmt(schedule.reduce((s, i) => s + i.principal_amount, 0))}</td>
                <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-700">{fmt(schedule.reduce((s, i) => s + i.interest_amount, 0))}</td>
                <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-900">{fmt(schedule.reduce((s, i) => s + i.total_amount, 0))}</td>
                <td className="px-3 py-2.5 text-right text-xs font-bold text-emerald-600">{fmt(schedule.reduce((s, i) => s + (i.total_paid || 0), 0))}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Pagos ────────────────────────────────────────────────────────────────
function TabPagos({ payments }: { payments: unknown[] }) {
  if (payments.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Sin pagos registrados</p>
        <p className="text-sm mt-1">Los pagos se registran desde el módulo de Cobros</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Recibo</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Fecha</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Capital</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Interés</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Método</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(payments as Record<string, unknown>[]).map((p, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-mono text-xs">{String(p.receipt_number || p.payment_number || '—')}</td>
                <td className="px-4 py-2.5 text-gray-600">{fmtDate(String(p.payment_date || ''))}</td>
                <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{fmt(Number(p.total_amount))}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">{fmt(Number(p.principal_amount))}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">{fmt(Number(p.interest_amount))}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">{String(p.payment_method || '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm mb-4">{icon}{title}</div>
      {children}
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value || '—'}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-gray-50 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  )
}

function BalanceRow({ label, amount, danger, bold }: { label: string; amount: number; danger?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={`text-sm ${bold ? 'font-bold text-gray-900' : 'text-gray-500'}`}>{label}</span>
      <span className={`text-sm ${bold ? 'font-bold text-gray-900' : danger ? 'font-semibold text-red-600' : 'text-gray-700'}`}>{fmt(amount)}</span>
    </div>
  )
}

function MiniKPI({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-100', amber: 'bg-amber-50 border-amber-100',
    green: 'bg-emerald-50 border-emerald-100', purple: 'bg-purple-50 border-purple-100',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color] || 'bg-gray-50 border-gray-100'}`}>
      <div className="flex items-center gap-2 text-gray-500 mb-2">{icon}<p className="text-xs font-medium">{label}</p></div>
      <p className="text-lg font-bold text-gray-900">{value}</p>
    </div>
  )
}

// ── Tab: Análisis de Recurrencia de Pagos ───────────────────────────────────
function TabRecurrencia({ data, onReload }: { data: RecurrenceAnalysis | null; onReload: () => void }) {
  if (!data) {
    return (
      <div className="flex flex-col items-center py-12">
        <RefreshCw className="h-6 w-6 text-primary-500 animate-spin mb-3" />
        <p className="text-gray-400 text-sm">Cargando análisis...</p>
      </div>
    )
  }

  if (!data.has_data) {
    return (
      <div className="text-center py-16 text-gray-400">
        <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Sin datos suficientes para analizar</p>
        <button onClick={onReload} className="mt-3 px-4 py-1.5 text-sm bg-primary-50 text-primary-600 rounded-lg">Reintentar</button>
      </div>
    )
  }

  const RATING_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
    EXCELLENT: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', bar: 'bg-emerald-500' },
    REGULAR:   { bg: 'bg-blue-50 border-blue-200',       text: 'text-blue-700',    bar: 'bg-blue-500' },
    IRREGULAR: { bg: 'bg-amber-50 border-amber-200',     text: 'text-amber-700',   bar: 'bg-amber-500' },
    POOR:      { bg: 'bg-red-50 border-red-200',         text: 'text-red-700',     bar: 'bg-red-500' },
    NEW:       { bg: 'bg-gray-50 border-gray-200',       text: 'text-gray-700',    bar: 'bg-gray-400' },
  }
  const color = RATING_COLORS[data.classification] || RATING_COLORS.NEW

  return (
    <div className="space-y-5">
      {/* Clasificación principal */}
      <div className={`rounded-2xl border-2 ${color.bg} p-6 text-center`}>
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Comportamiento de Pago</p>
        <p className={`text-3xl font-black ${color.text}`}>{data.classification_label}</p>
        <div className="flex items-center justify-center gap-3 mt-4">
          <div className={`text-5xl font-black ${color.text}`}>{data.score}</div>
          <div className="text-left">
            <p className="text-xs text-gray-500">Score</p>
            <p className="text-xs text-gray-500">de 100</p>
          </div>
        </div>
        <div className="w-64 h-2 bg-white rounded-full mx-auto mt-3 overflow-hidden">
          <div className={`h-full ${color.bar} rounded-full transition-all`} style={{ width: `${data.score}%` }} />
        </div>
      </div>

      {/* Distribución de cuotas */}
      <Section title="Distribución de Cuotas Pagadas" icon={<BarChart3 className="h-4 w-4" />}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <DistCard label="A tiempo"           value={data.on_time}   color="emerald" />
          <DistCard label="Tarde (≤30 días)" value={data.late}      color="amber" />
          <DistCard label="Muy tarde (>30 días)" value={data.very_late} color="red" />
          <DistCard label="Vencidas (no pagas)"  value={data.unpaid}    color="gray" />
        </div>
        {data.total_paid_installments > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Tasa de pago a tiempo</span>
              <span className="font-bold">{data.on_time_rate}%</span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
              {data.on_time > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${(data.on_time / data.total_paid_installments) * 100}%` }} />}
              {data.late > 0 && <div className="bg-amber-500 h-full" style={{ width: `${(data.late / data.total_paid_installments) * 100}%` }} />}
              {data.very_late > 0 && <div className="bg-red-500 h-full" style={{ width: `${(data.very_late / data.total_paid_installments) * 100}%` }} />}
            </div>
          </div>
        )}
      </Section>

      {/* Métricas */}
      <Section title="Estadísticas de Pagos" icon={<Activity className="h-4 w-4" />}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <InfoItem label="Total de pagos" value={String(data.payments_count)} />
          <InfoItem label="Cuota mensual" value={fmt(data.monthly_payment)} />
          <InfoItem label="Días promedio de atraso" value={`${data.avg_days_late} días`} />
          <InfoItem label="Intervalo promedio entre pagos" value={`${data.avg_payment_interval_days} días`} />
          <InfoItem label="Pagos últimos 3 meses" value={String(data.recent_payments_3m)} />
          <InfoItem label="Monto recientes (3m)" value={fmt(data.recent_amount_3m)} />
        </div>
      </Section>

      {/* Tendencia */}
      <div className={`p-4 rounded-xl border ${data.recent_payments_3m >= data.older_payments / 3 ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">📈 Tendencia</p>
        <p className="text-sm">
          {data.recent_payments_3m === 0
            ? <span className="text-red-700 font-medium">⚠️ El cliente no ha realizado pagos en los últimos 3 meses</span>
            : data.classification === 'EXCELLENT'
              ? <span className="text-emerald-700 font-medium">✅ Cliente de pago puntual y consistente</span>
              : data.classification === 'IRREGULAR' || data.classification === 'POOR'
                ? <span className="text-red-700 font-medium">⚠️ Patrón de pagos irregulares, requiere seguimiento</span>
                : <span className="text-blue-700 font-medium">👍 Comportamiento aceptable, continuar monitoreo</span>}
        </p>
      </div>
    </div>
  )
}

function DistCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    red: 'bg-red-50 border-red-100 text-red-700',
    gray: 'bg-gray-50 border-gray-100 text-gray-600',
  }
  return (
    <div className={`p-3 rounded-xl border text-center ${colors[color]}`}>
      <p className="text-2xl font-black">{value}</p>
      <p className="text-xs mt-0.5">{label}</p>
    </div>
  )
}

// evitar warning de unused
export { pct }
