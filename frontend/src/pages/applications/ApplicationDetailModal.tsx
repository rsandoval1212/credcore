import { useState } from 'react'
import {
  X, Send, CheckCircle, XCircle, Banknote, Clock,
  User, FileText, Activity, ChevronRight, AlertTriangle,
  DollarSign, Calendar, BarChart3, Edit3,
} from 'lucide-react'
import { applicationsService } from '@/services/applications'
import type { LoanApplication, ApplicationStatus } from '@/types'
import { extractApiError } from '@/utils/apiError'
import toast from 'react-hot-toast'

interface Props {
  application: LoanApplication
  onClose: () => void
  onUpdated: (app: LoanApplication) => void
}

const STATUS_META: Record<ApplicationStatus, { label: string; color: string }> = {
  DRAFT:        { label: 'Borrador',      color: 'bg-gray-100 text-gray-600' },
  SUBMITTED:    { label: 'Enviada',       color: 'bg-blue-100 text-blue-700' },
  UNDER_REVIEW: { label: 'En Revisión',   color: 'bg-amber-100 text-amber-700' },
  APPROVED:     { label: 'Aprobada',      color: 'bg-emerald-100 text-emerald-700' },
  REJECTED:     { label: 'Rechazada',     color: 'bg-red-100 text-red-700' },
  CANCELLED:    { label: 'Cancelada',     color: 'bg-gray-100 text-gray-500' },
  DISBURSED:    { label: 'Desembolsada',  color: 'bg-purple-100 text-purple-700' },
}

const TABS = [
  { id: 'info',      label: 'Información',  icon: FileText },
  { id: 'financiero',label: 'Análisis',     icon: BarChart3 },
  { id: 'workflow',  label: 'Historial',    icon: Activity },
]

function fmt(n?: number | null) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n)
}
function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ApplicationDetailModal({ application: app, onClose, onUpdated }: Props) {
  const [tab, setTab] = useState('info')
  const [loading, setLoading] = useState(false)

  // Approval form state
  const [showApproveForm, setShowApproveForm] = useState(false)
  const [approveData, setApproveData] = useState({
    approved_amount: String(app.requested_amount),
    approved_term_months: String(app.requested_term_months),
    approved_rate: String(app.product_rate || ''),
    comments: '',
  })

  // Reject form state
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const meta = STATUS_META[app.status]

  const action = async (fn: () => Promise<{ data: LoanApplication }>, successMsg: string) => {
    setLoading(true)
    try {
      const r = await fn()
      toast.success(successMsg)
      onUpdated(r.data)
      setShowApproveForm(false)
      setShowRejectForm(false)
    } catch (e: unknown) {
      toast.error(extractApiError(e, 'Error procesando acción'))
    } finally {
      setLoading(false)
    }
  }

  const handleDisburse = async () => {
    if (!window.confirm('¿Confirmas el desembolso? Se creará el préstamo automáticamente.')) return
    setLoading(true)
    try {
      await applicationsService.disburse(app.id)
      toast.success('Préstamo desembolsado exitosamente')
      onClose()
    } catch (e: unknown) {
      toast.error(extractApiError(e, 'Error en desembolso'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-gray-900">{app.application_number}</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${meta.color}`}>{meta.label}</span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{app.customer_name} · {app.product_name}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 mt-3">
            {TABS.map(t => {
              const Icon = t.icon
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  <Icon className="h-3.5 w-3.5" />{t.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'info' && <TabInfo app={app} />}
          {tab === 'financiero' && <TabFinanciero app={app} />}
          {tab === 'workflow' && <TabWorkflow app={app} />}
        </div>

        {/* Workflow Actions Footer */}
        <div className="shrink-0 border-t border-gray-100 px-6 py-4">

          {/* Approve form */}
          {showApproveForm && (
            <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
              <p className="text-sm font-semibold text-emerald-700 flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Aprobar Solicitud</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Monto aprobado</label>
                  <input type="number" value={approveData.approved_amount} onChange={e => setApproveData(d => ({ ...d, approved_amount: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Plazo (meses)</label>
                  <input type="number" value={approveData.approved_term_months} onChange={e => setApproveData(d => ({ ...d, approved_term_months: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Tasa anual %</label>
                  <input type="number" step="0.001" value={approveData.approved_rate} onChange={e => setApproveData(d => ({ ...d, approved_rate: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <input type="text" placeholder="Comentarios (opcional)" value={approveData.comments} onChange={e => setApproveData(d => ({ ...d, comments: e.target.value }))}
                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowApproveForm(false)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button onClick={() => action(() => applicationsService.approve(app.id, {
                  approved_amount: parseFloat(approveData.approved_amount),
                  approved_term_months: parseInt(approveData.approved_term_months),
                  approved_rate: parseFloat(approveData.approved_rate),
                  comments: approveData.comments,
                }), 'Solicitud aprobada')} disabled={loading}
                  className="px-4 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 font-medium">
                  {loading ? 'Procesando...' : 'Confirmar Aprobación'}
                </button>
              </div>
            </div>
          )}

          {/* Reject form */}
          {showRejectForm && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
              <p className="text-sm font-semibold text-red-700 flex items-center gap-2"><XCircle className="h-4 w-4" /> Rechazar Solicitud</p>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2}
                placeholder="Motivo del rechazo (requerido)..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowRejectForm(false)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button onClick={() => { if (!rejectReason.trim()) { toast.error('Indica el motivo'); return } action(() => applicationsService.reject(app.id, rejectReason), 'Solicitud rechazada') }}
                  disabled={loading} className="px-4 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 font-medium">
                  {loading ? 'Procesando...' : 'Confirmar Rechazo'}
                </button>
              </div>
            </div>
          )}

          {/* Action buttons por estado */}
          <div className="flex flex-wrap gap-2 justify-between items-center">
            <div className="flex flex-wrap gap-2">
              {app.status === 'DRAFT' && (
                <ActionBtn icon={<Send className="h-4 w-4" />} label="Enviar a Revisión" color="blue"
                  onClick={() => action(() => applicationsService.submit(app.id), 'Solicitud enviada')} loading={loading} />
              )}
              {app.status === 'SUBMITTED' && (
                <ActionBtn icon={<Clock className="h-4 w-4" />} label="Tomar para Revisión" color="amber"
                  onClick={() => action(() => applicationsService.startReview(app.id), 'En revisión')} loading={loading} />
              )}
              {(app.status === 'SUBMITTED' || app.status === 'UNDER_REVIEW') && (
                <>
                  <ActionBtn icon={<CheckCircle className="h-4 w-4" />} label="Aprobar" color="green"
                    onClick={() => { setShowRejectForm(false); setShowApproveForm(v => !v) }} loading={false} />
                  <ActionBtn icon={<XCircle className="h-4 w-4" />} label="Rechazar" color="red"
                    onClick={() => { setShowApproveForm(false); setShowRejectForm(v => !v) }} loading={false} />
                </>
              )}
              {app.status === 'APPROVED' && (
                <ActionBtn icon={<Banknote className="h-4 w-4" />} label="Desembolsar" color="purple"
                  onClick={handleDisburse} loading={loading} />
              )}
              {(app.status === 'DRAFT' || app.status === 'SUBMITTED' || app.status === 'UNDER_REVIEW') && (
                <ActionBtn icon={<XCircle className="h-4 w-4" />} label="Cancelar" color="gray"
                  onClick={() => action(() => applicationsService.cancel(app.id), 'Solicitud cancelada')} loading={loading} />
              )}
            </div>
            <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Información ─────────────────────────────────────────────────────────
function TabInfo({ app }: { app: LoanApplication }) {
  return (
    <div className="space-y-5">
      <Section title="Cliente" icon={<User className="h-4 w-4" />}>
        <Grid>
          <InfoItem label="Nombre" value={app.customer_name} />
          <InfoItem label="Código" value={app.customer_code} />
          <InfoItem label="Cédula" value={app.customer_id_number} />
          <InfoItem label="Teléfono" value={app.customer_phone} />
          <InfoItem label="Score crediticio" value={app.customer_credit_score != null ? String(app.customer_credit_score) : '—'} />
          <InfoItem label="Riesgo" value={
            <span className={app.customer_risk === 'LOW' ? 'text-blue-600' : app.customer_risk === 'HIGH' ? 'text-red-600' : 'text-amber-600'}>
              {app.customer_risk === 'LOW' ? 'Bajo' : app.customer_risk === 'MEDIUM' ? 'Medio' : app.customer_risk === 'HIGH' ? 'Alto' : '—'}
            </span>
          } />
        </Grid>
      </Section>

      <Section title="Solicitud" icon={<FileText className="h-4 w-4" />}>
        <Grid>
          <InfoItem label="Número" value={app.application_number} />
          <InfoItem label="Producto" value={app.product_name} />
          <InfoItem label="Monto solicitado" value={fmt(app.requested_amount)} />
          <InfoItem label="Plazo solicitado" value={`${app.requested_term_months} meses`} />
          {app.approved_amount && <InfoItem label="Monto aprobado" value={<span className="text-emerald-600 font-semibold">{fmt(app.approved_amount)}</span>} />}
          {app.approved_term_months && <InfoItem label="Plazo aprobado" value={`${app.approved_term_months} meses`} />}
          {app.approved_rate && <InfoItem label="Tasa aprobada" value={`${app.approved_rate}% anual`} />}
        </Grid>
        <div className="mt-3">
          <p className="text-xs text-gray-400 mb-1">Propósito</p>
          <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{app.purpose || '—'}</p>
        </div>
      </Section>

      <Section title="Fechas" icon={<Calendar className="h-4 w-4" />}>
        <Grid>
          <InfoItem label="Creada" value={fmtDate(app.created_at)} />
          <InfoItem label="Enviada" value={fmtDate(app.submitted_at)} />
          <InfoItem label="Aprobada" value={fmtDate(app.approved_at)} />
          <InfoItem label="Desembolsada" value={fmtDate(app.disbursed_at)} />
          {app.rejected_at && <InfoItem label="Rechazada" value={fmtDate(app.rejected_at)} />}
        </Grid>
      </Section>

      {app.status === 'REJECTED' && app.rejection_reason && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-700 flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4" /> Motivo de Rechazo
          </p>
          <p className="text-sm text-red-600">{app.rejection_reason}</p>
          {app.rejected_by_name && <p className="text-xs text-red-400 mt-1">Por: {app.rejected_by_name}</p>}
        </div>
      )}

      {app.assigned_to_name && (
        <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-xl p-3">
          <User className="h-4 w-4 text-gray-400" />
          Asignado a: <span className="font-medium">{app.assigned_to_name}</span>
        </div>
      )}
    </div>
  )
}

// ── Tab: Análisis Financiero ──────────────────────────────────────────────────
function TabFinanciero({ app }: { app: LoanApplication }) {
  const dti = app.debt_to_income_ratio ? Number(app.debt_to_income_ratio) : null
  const score = app.credit_score_at_application

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        {/* Cuota estimada */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-500 uppercase mb-1 flex items-center gap-1">
            <DollarSign className="h-3.5 w-3.5" /> Cuota Mensual Estimada
          </p>
          <p className="text-2xl font-black text-blue-700">{fmt(app.monthly_payment_estimate)}</p>
        </div>
        {/* DTI */}
        <div className={`border rounded-xl p-4 ${dti != null && dti > 50 ? 'bg-red-50 border-red-100' : dti != null && dti > 35 ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
          <p className="text-xs font-semibold uppercase mb-1 text-gray-500">Relación Deuda/Ingreso</p>
          <p className={`text-2xl font-black ${dti != null && dti > 50 ? 'text-red-700' : dti != null && dti > 35 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {dti != null ? `${dti.toFixed(1)}%` : '—'}
          </p>
          {dti != null && (
            <p className="text-xs mt-1 text-gray-500">
              {dti > 50 ? '⚠ Alto riesgo de sobreendeudamiento' : dti > 35 ? 'Riesgo moderado' : 'Dentro del límite aceptable'}
            </p>
          )}
        </div>
      </div>

      {/* Score */}
      {score != null && (
        <Section title="Score al Momento de la Solicitud" icon={<BarChart3 className="h-4 w-4" />}>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className={`text-3xl font-black ${score >= 750 ? 'text-emerald-600' : score >= 500 ? 'text-amber-600' : 'text-red-600'}`}>{score}</p>
              <p className="text-xs text-gray-400">/ 1000</p>
            </div>
            <div className="flex-1">
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${score >= 750 ? 'bg-emerald-400' : score >= 500 ? 'bg-amber-400' : 'bg-red-400'}`}
                  style={{ width: `${(score / 1000) * 100}%` }} />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0</span><span>500</span><span>1000</span>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* Indicadores de riesgo */}
      <Section title="Indicadores de Riesgo" icon={<AlertTriangle className="h-4 w-4" />}>
        <div className="space-y-3">
          <RiskIndicator
            label="Nivel de Riesgo"
            value={app.risk_level === 'LOW' ? 'Bajo' : app.risk_level === 'MEDIUM' ? 'Medio' : 'Alto'}
            status={app.risk_level === 'LOW' ? 'good' : app.risk_level === 'MEDIUM' ? 'warning' : 'danger'}
          />
          <RiskIndicator
            label="Ratio Deuda/Ingreso"
            value={dti != null ? `${dti.toFixed(1)}%` : '—'}
            status={dti == null ? 'neutral' : dti <= 35 ? 'good' : dti <= 50 ? 'warning' : 'danger'}
          />
          <RiskIndicator
            label="Score Crediticio"
            value={score != null ? String(score) : 'Sin evaluar'}
            status={score == null ? 'neutral' : score >= 700 ? 'good' : score >= 500 ? 'warning' : 'danger'}
          />
          <RiskIndicator
            label="Ingreso mensual cliente"
            value={fmt(app.customer_income)}
            status="neutral"
          />
        </div>
      </Section>

      {app.notes && (
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 flex items-center gap-1 mb-2"><Edit3 className="h-3.5 w-3.5" /> Notas</p>
          <p className="text-sm text-gray-700">{app.notes}</p>
        </div>
      )}
    </div>
  )
}

// ── Tab: Historial Workflow ───────────────────────────────────────────────────
function TabWorkflow({ app }: { app: LoanApplication }) {
  const logs = app.workflow_logs || []

  const ACTION_ICONS: Record<string, React.ReactNode> = {
    SUBMITTED:     <Send className="h-4 w-4 text-blue-500" />,
    APPROVED_STEP: <CheckCircle className="h-4 w-4 text-emerald-500" />,
    REJECTED:      <XCircle className="h-4 w-4 text-red-500" />,
    CANCELLED:     <XCircle className="h-4 w-4 text-gray-400" />,
    DISBURSED:     <Banknote className="h-4 w-4 text-purple-500" />,
    RETURNED:      <ChevronRight className="h-4 w-4 text-amber-500" />,
    ESCALATED:     <ChevronRight className="h-4 w-4 text-orange-500" />,
  }

  return (
    <div className="space-y-3">
      {logs.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Sin movimientos en el historial</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-100" />
          <div className="space-y-4">
            {logs.map((log, i) => (
              <div key={i} className="flex gap-4 relative">
                <div className="w-10 h-10 rounded-full bg-white border-2 border-gray-100 flex items-center justify-center shrink-0 z-10">
                  {ACTION_ICONS[log.action] || <Activity className="h-4 w-4 text-gray-400" />}
                </div>
                <div className="flex-1 bg-gray-50 rounded-xl p-3 min-h-[40px]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-gray-900">{log.action_display}</span>
                    <span className="text-xs text-gray-400">{fmtDate(log.created_at)}</span>
                  </div>
                  {log.comments && <p className="text-sm text-gray-600 mt-1">{log.comments}</p>}
                  <p className="text-xs text-gray-400 mt-1">Por: {log.performed_by_name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helpers UI ────────────────────────────────────────────────────────────────
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm mb-4">{icon}{title}</div>
      {children}
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{children}</div>
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value || '—'}</p>
    </div>
  )
}

function RiskIndicator({ label, value, status }: { label: string; value: string; status: 'good' | 'warning' | 'danger' | 'neutral' }) {
  const colors = {
    good: 'text-emerald-600 bg-emerald-50',
    warning: 'text-amber-600 bg-amber-50',
    danger: 'text-red-600 bg-red-50',
    neutral: 'text-gray-600 bg-gray-50',
  }
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${colors[status]}`}>{value}</span>
    </div>
  )
}

function ActionBtn({ icon, label, color, onClick, loading }: {
  icon: React.ReactNode; label: string; color: string; onClick: () => void; loading: boolean
}) {
  const colorMap: Record<string, string> = {
    blue:   'bg-blue-600 hover:bg-blue-700 text-white',
    amber:  'bg-amber-500 hover:bg-amber-600 text-white',
    green:  'bg-emerald-600 hover:bg-emerald-700 text-white',
    red:    'bg-red-600 hover:bg-red-700 text-white',
    purple: 'bg-purple-600 hover:bg-purple-700 text-white',
    gray:   'bg-gray-200 hover:bg-gray-300 text-gray-700',
  }
  return (
    <button onClick={onClick} disabled={loading}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${colorMap[color] || colorMap.gray}`}>
      {icon}{label}
    </button>
  )
}
