import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Edit, User, MapPin, Briefcase, FileText, CreditCard,
  Users, Phone, AlertTriangle, CheckCircle, Clock, MessageSquare,
  TrendingUp, RefreshCw, Plus, Shield, Star, Activity,
  Calendar, DollarSign, Banknote,
} from 'lucide-react'
import { customersService } from '@/services/customers'
import type {
  Customer, CustomerActivity, CustomerCreditEvaluation,
  CustomerReference, CustomerGuarantor,
} from '@/types'
import toast from 'react-hot-toast'
import CustomerFormModal from './CustomerFormModal'

const TABS = [
  { id: 'dashboard', label: 'Resumen', icon: Activity },
  { id: 'personal', label: 'Personal', icon: User },
  { id: 'laboral', label: 'Laboral', icon: Briefcase },
  { id: 'financiero', label: 'Financiero', icon: DollarSign },
  { id: 'referencias', label: 'Referencias', icon: Users },
  { id: 'documentos', label: 'Documentos', icon: FileText },
  { id: 'historial', label: 'Historial', icon: CreditCard },
  { id: 'seguimiento', label: 'Seguimiento', icon: MessageSquare },
  { id: 'evaluacion', label: 'Evaluación', icon: Star },
]

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  INACTIVE: 'bg-gray-100 text-gray-600 border-gray-200',
  BLOCKED: 'bg-red-100 text-red-700 border-red-200',
}
const RISK_COLORS: Record<string, string> = {
  LOW: 'text-blue-600',
  MEDIUM: 'text-amber-600',
  HIGH: 'text-red-600',
}

function fmt(n?: number | null) {
  if (n == null) return 'RD$0'
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n)
}
function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('dashboard')
  const [showEdit, setShowEdit] = useState(false)
  const [activities, setActivities] = useState<CustomerActivity[]>([])
  const [evaluation, setEvaluation] = useState<CustomerCreditEvaluation | null>(null)
  const [evaluating, setEvaluating] = useState(false)
  const [loanHistory, setLoanHistory] = useState<unknown[]>([])

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await customersService.get(id)
      setCustomer(res.data)
      if (res.data.latest_evaluation) setEvaluation(res.data.latest_evaluation)
    } catch {
      toast.error('Error cargando cliente')
    } finally {
      setLoading(false)
    }
  }, [id])

  const loadActivities = useCallback(async () => {
    if (!id) return
    try {
      const r = await customersService.getActivities(id)
      setActivities(r.data)
    } catch {}
  }, [id])

  const loadLoanHistory = useCallback(async () => {
    if (!id) return
    try {
      const r = await customersService.getLoanHistory(id)
      setLoanHistory(r.data)
    } catch {}
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (tab === 'seguimiento') loadActivities() }, [tab, loadActivities])
  useEffect(() => { if (tab === 'historial') loadLoanHistory() }, [tab, loadLoanHistory])

  const runEvaluation = async () => {
    if (!id) return
    setEvaluating(true)
    try {
      const r = await customersService.runCreditEvaluation(id)
      setEvaluation(r.data)
      toast.success('Evaluación crediticia completada')
      load()
    } catch {
      toast.error('Error en evaluación')
    } finally {
      setEvaluating(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <RefreshCw className="h-6 w-6 text-primary-500 animate-spin" />
    </div>
  )

  if (!customer) return (
    <div className="p-6 text-center text-gray-500">Cliente no encontrado</div>
  )

  const fs = customer.financial_summary

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4 shrink-0">
        <button onClick={() => navigate('/customers')} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden shrink-0">
            {customer.photo
              ? <img src={customer.photo} alt="" className="w-full h-full object-cover" />
              : <span className="text-primary-700 font-bold text-lg">{customer.full_name?.charAt(0)?.toUpperCase()}</span>
            }
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-900">{customer.full_name}</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[customer.status]}`}>
                {customer.status_display}
              </span>
            </div>
            <p className="text-sm text-gray-400">{customer.customer_code} · {customer.id_type}: {customer.id_number}</p>
          </div>
        </div>
        <button onClick={() => setShowEdit(true)} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium">
          <Edit className="h-4 w-4" /> Editar
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-6 shrink-0">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'dashboard' && <TabDashboard customer={customer} evaluation={evaluation} onEvaluate={runEvaluation} evaluating={evaluating} />}
        {tab === 'personal' && <TabPersonal customer={customer} />}
        {tab === 'laboral' && <TabLaboral customer={customer} />}
        {tab === 'financiero' && <TabFinanciero customer={customer} />}
        {tab === 'referencias' && <TabReferencias customer={customer} />}
        {tab === 'documentos' && <TabDocumentos customer={customer} />}
        {tab === 'historial' && <TabHistorial loans={loanHistory} fs={fs} />}
        {tab === 'seguimiento' && <TabSeguimiento activities={activities} customerId={id!} onAdded={loadActivities} />}
        {tab === 'evaluacion' && <TabEvaluacion evaluation={evaluation} onEvaluate={runEvaluation} evaluating={evaluating} customer={customer} />}
      </div>

      {showEdit && customer && (
        <CustomerFormModal customer={customer} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); load() }} />
      )}
    </div>
  )
}

// ─── TAB: Dashboard ──────────────────────────────────────────────────────────
function TabDashboard({ customer, evaluation, onEvaluate, evaluating }: {
  customer: Customer; evaluation: CustomerCreditEvaluation | null;
  onEvaluate: () => void; evaluating: boolean
}) {
  const fs = customer.financial_summary
  const score = evaluation?.score ?? customer.credit_score

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Préstamos activos" value={String(customer.active_loans_count)} sub={`${customer.total_loans_count} total`} color="blue" icon={<CreditCard className="h-5 w-5" />} />
        <KPICard label="Saldo pendiente" value={fmt(customer.outstanding_balance)} sub="capital + intereses" color="amber" icon={<Banknote className="h-5 w-5" />} />
        <KPICard label="Total prestado" value={fmt(fs?.total_disbursed)} sub={`${fs?.completed_loans ?? 0} cancelados`} color="purple" icon={<TrendingUp className="h-5 w-5" />} />
        <KPICard label="Total recuperado" value={fmt(customer.total_paid)} sub={`${fs?.payment_on_time_rate ?? 0}% a tiempo`} color="green" icon={<CheckCircle className="h-5 w-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Próximo pago */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Próximo Pago</p>
          {fs?.next_payment_date ? (
            <>
              <p className="text-2xl font-bold text-gray-900">{fmt(fs.next_payment_amount)}</p>
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(fs.next_payment_date)}</p>
            </>
          ) : (
            <p className="text-gray-400 text-sm">Sin pagos pendientes</p>
          )}
        </div>

        {/* Mora */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Indicadores de Mora</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Días máx. de mora</span>
              <span className={`font-bold ${(fs?.max_days_past_due ?? 0) > 30 ? 'text-red-600' : 'text-gray-900'}`}>{fs?.max_days_past_due ?? 0} días</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Atrasos acumulados</span>
              <span className="font-bold text-gray-900">{fs?.total_late_count ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Préstamos en default</span>
              <span className={`font-bold ${(fs?.defaulted_loans ?? 0) > 0 ? 'text-red-600' : 'text-gray-900'}`}>{fs?.defaulted_loans ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Score */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase">Score Crediticio</p>
            <button onClick={onEvaluate} disabled={evaluating} className="text-xs text-primary-600 hover:underline disabled:opacity-50">
              {evaluating ? 'Calculando...' : 'Recalcular'}
            </button>
          </div>
          {score != null ? (
            <>
              <div className="flex items-end gap-2">
                <span className={`text-3xl font-black ${RISK_COLORS[customer.risk_level]}`}>{score}</span>
                <span className="text-gray-400 text-sm mb-1">/1000</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${customer.risk_level === 'LOW' ? 'bg-emerald-400' : customer.risk_level === 'MEDIUM' ? 'bg-amber-400' : 'bg-red-400'}`}
                  style={{ width: `${(score / 1000) * 100}%` }}
                />
              </div>
              <p className={`text-sm font-semibold mt-2 ${RISK_COLORS[customer.risk_level]}`}>
                {customer.risk_level_display}
              </p>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-400 text-sm mb-3">Sin evaluación</p>
              <button onClick={onEvaluate} disabled={evaluating} className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs hover:bg-primary-700 disabled:opacity-50">
                Evaluar ahora
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Info rápida */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase mb-4">Información Rápida</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <InfoItem label="Nivel de riesgo" value={<span className={`font-semibold ${RISK_COLORS[customer.risk_level]}`}>{customer.risk_level_display}</span>} />
          <InfoItem label="Fecha de registro" value={fmtDate(customer.created_at)} />
          <InfoItem label="Ingreso mensual" value={fmt(customer.monthly_income)} />
          <InfoItem label="Capacidad de pago" value={fmt(customer.payment_capacity)} />
          <InfoItem label="Teléfono" value={customer.phone1} />
          <InfoItem label="Email" value={customer.email || '—'} />
          <InfoItem label="Provincia" value={customer.province || '—'} />
          <InfoItem label="Ocupación" value={customer.occupation || '—'} />
        </div>
      </div>

      {customer.is_blacklisted && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700">Cliente en Lista Negra</p>
            <p className="text-sm text-red-600 mt-0.5">{customer.blacklist_reason || 'Sin razón especificada'}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TAB: Personal ──────────────────────────────────────────────────────────
function TabPersonal({ customer }: { customer: Customer }) {
  return (
    <div className="space-y-6">
      <Section title="Información Personal" icon={<User className="h-4 w-4" />}>
        <Grid>
          <InfoItem label="Código de cliente" value={customer.customer_code} />
          <InfoItem label="Tipo" value={customer.customer_type === 'NATURAL' ? 'Persona Natural' : 'Persona Jurídica'} />
          {customer.customer_type === 'NATURAL' ? (
            <>
              <InfoItem label="Primer nombre" value={customer.first_name} />
              <InfoItem label="Segundo nombre" value={customer.second_name || '—'} />
              <InfoItem label="Primer apellido" value={customer.last_name} />
              <InfoItem label="Segundo apellido" value={customer.second_last_name || '—'} />
              <InfoItem label="Sexo" value={customer.gender_display || '—'} />
              <InfoItem label="Estado civil" value={customer.marital_status_display || '—'} />
              <InfoItem label="Fecha de nacimiento" value={fmtDate(customer.date_of_birth)} />
              <InfoItem label="Nacionalidad" value={customer.nationality || '—'} />
            </>
          ) : (
            <>
              <InfoItem label="Nombre empresa" value={customer.company_name} />
              <InfoItem label="Tipo empresa" value={customer.company_type || '—'} />
            </>
          )}
          <InfoItem label="Tipo de documento" value={customer.id_type} />
          <InfoItem label="Número de documento" value={customer.id_number} />
          <InfoItem label="Vencimiento doc." value={fmtDate(customer.id_expiry_date)} />
        </Grid>
      </Section>

      <Section title="Contacto" icon={<Phone className="h-4 w-4" />}>
        <Grid>
          <InfoItem label="Teléfono principal" value={customer.phone1} />
          <InfoItem label="Teléfono secundario" value={customer.phone2 || '—'} />
          <InfoItem label="WhatsApp" value={customer.whatsapp || '—'} />
          <InfoItem label="Correo electrónico" value={customer.email || '—'} />
        </Grid>
      </Section>

      <Section title="Dirección" icon={<MapPin className="h-4 w-4" />}>
        <Grid>
          <InfoItem label="País" value={customer.country} />
          <InfoItem label="Provincia" value={customer.province || '—'} />
          <InfoItem label="Municipio" value={customer.municipality || '—'} />
          <InfoItem label="Sector" value={customer.sector || '—'} />
          <InfoItem label="Calle" value={customer.address || '—'} />
          <InfoItem label="Referencia" value={customer.address_reference || '—'} />
          {customer.latitude && <InfoItem label="Latitud" value={String(customer.latitude)} />}
          {customer.longitude && <InfoItem label="Longitud" value={String(customer.longitude)} />}
        </Grid>
      </Section>
    </div>
  )
}

// ─── TAB: Laboral ──────────────────────────────────────────────────────────
function TabLaboral({ customer }: { customer: Customer }) {
  const emp = customer.employment
  const biz = customer.business
  return (
    <div className="space-y-6">
      <Section title="Empleo" icon={<Briefcase className="h-4 w-4" />}>
        {emp ? (
          <Grid>
            <InfoItem label="Empresa" value={emp.company || '—'} />
            <InfoItem label="Cargo" value={emp.position || '—'} />
            <InfoItem label="Fecha de ingreso" value={fmtDate(emp.start_date)} />
            <InfoItem label="Salario" value={fmt(emp.salary)} />
            <InfoItem label="Tipo de contrato" value={emp.contract_type || '—'} />
            <InfoItem label="Tel. empresa" value={emp.company_phone || '—'} />
            <InfoItem label="Supervisor" value={emp.supervisor_name || '—'} />
            <InfoItem label="Tel. supervisor" value={emp.supervisor_phone || '—'} />
          </Grid>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <InfoItem label="Ocupación" value={customer.occupation || '—'} />
            <InfoItem label="Empleador" value={customer.employer || '—'} />
            <InfoItem label="Tel. empleador" value={customer.employer_phone || '—'} />
            <InfoItem label="Años en empleo" value={customer.employment_years ? `${customer.employment_years} años` : '—'} />
          </div>
        )}
      </Section>

      {biz && (
        <Section title="Negocio Propio" icon={<Briefcase className="h-4 w-4" />}>
          <Grid>
            <InfoItem label="Nombre del negocio" value={biz.business_name || '—'} />
            <InfoItem label="Actividad" value={biz.activity_type || '—'} />
            <InfoItem label="Tiempo operando" value={biz.years_operating ? `${biz.years_operating} años` : '—'} />
            <InfoItem label="Ingresos mensuales" value={fmt(biz.monthly_income)} />
            <InfoItem label="Gastos mensuales" value={fmt(biz.monthly_expenses)} />
            <InfoItem label="RNC" value={biz.rnc || '—'} />
          </Grid>
        </Section>
      )}
    </div>
  )
}

// ─── TAB: Financiero ──────────────────────────────────────────────────────
function TabFinanciero({ customer }: { customer: Customer }) {
  const fi = customer.financial_info
  const totalIncome = fi?.total_income ?? (parseFloat(String(customer.monthly_income || 0)) + parseFloat(String(customer.other_income || 0)))
  const totalExpenses = fi?.total_expenses ?? parseFloat(String(customer.monthly_expenses || 0))
  const capacity = fi?.payment_capacity ?? (totalIncome - totalExpenses)

  return (
    <div className="space-y-6">
      {fi ? (
        <>
          <Section title="Ingresos" icon={<TrendingUp className="h-4 w-4" />}>
            <Grid>
              <InfoItem label="Salario" value={fmt(fi.salary_income)} />
              <InfoItem label="Comisiones" value={fmt(fi.commission_income)} />
              <InfoItem label="Negocios" value={fmt(fi.business_income)} />
              <InfoItem label="Otros ingresos" value={fmt(fi.other_income)} />
              <InfoItem label="TOTAL INGRESOS" value={<span className="font-bold text-emerald-600">{fmt(fi.total_income)}</span>} />
            </Grid>
          </Section>
          <Section title="Gastos" icon={<DollarSign className="h-4 w-4" />}>
            <Grid>
              <InfoItem label="Vivienda" value={fmt(fi.housing_expenses)} />
              <InfoItem label="Alimentación" value={fmt(fi.food_expenses)} />
              <InfoItem label="Transporte" value={fmt(fi.transport_expenses)} />
              <InfoItem label="Servicios" value={fmt(fi.services_expenses)} />
              <InfoItem label="Educación" value={fmt(fi.education_expenses)} />
              <InfoItem label="TOTAL GASTOS" value={<span className="font-bold text-red-600">{fmt(fi.total_expenses)}</span>} />
            </Grid>
          </Section>
          <Section title="Endeudamiento" icon={<CreditCard className="h-4 w-4" />}>
            <Grid>
              <InfoItem label="Préstamos activos" value={fmt(fi.active_loans_debt)} />
              <InfoItem label="Tarjetas de crédito" value={fmt(fi.credit_card_debt)} />
              <InfoItem label="Cuotas mensuales" value={fmt(fi.monthly_installments)} />
            </Grid>
          </Section>
        </>
      ) : (
        <Section title="Ingresos y Gastos" icon={<DollarSign className="h-4 w-4" />}>
          <Grid>
            <InfoItem label="Ingreso mensual" value={fmt(customer.monthly_income)} />
            <InfoItem label="Otros ingresos" value={fmt(customer.other_income)} />
            <InfoItem label="Gastos mensuales" value={fmt(customer.monthly_expenses)} />
          </Grid>
        </Section>
      )}

      <div className={`rounded-xl p-5 border ${capacity >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
        <p className="text-sm text-gray-500 mb-1">Capacidad de Pago Calculada</p>
        <p className={`text-2xl font-black ${capacity >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmt(capacity)}</p>
        <p className="text-xs text-gray-400 mt-1">Ingresos totales − Gastos totales − Cuotas vigentes</p>
      </div>
    </div>
  )
}

// ─── TAB: Referencias ──────────────────────────────────────────────────────
function TabReferencias({ customer }: { customer: Customer }) {
  return (
    <div className="space-y-6">
      <Section title="Referencias Personales" icon={<Users className="h-4 w-4" />}>
        {(customer.references?.length ?? 0) === 0 ? (
          <p className="text-gray-400 text-sm">Sin referencias personales registradas</p>
        ) : (
          <div className="space-y-3">
            {customer.references?.map((r: CustomerReference) => (
              <div key={r.id} className="p-4 bg-gray-50 rounded-xl">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-900">{r.name}</p>
                    <p className="text-xs text-gray-400">{r.relationship_display || r.relationship}</p>
                  </div>
                  <span className="flex items-center gap-1 text-sm text-gray-600"><Phone className="h-3 w-3" />{r.phone}</span>
                </div>
                {r.address && <p className="text-xs text-gray-500 mt-2 flex items-center gap-1"><MapPin className="h-3 w-3" />{r.address}</p>}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Referencias Comerciales" icon={<Briefcase className="h-4 w-4" />}>
        {(customer.commercial_references?.length ?? 0) === 0 ? (
          <p className="text-gray-400 text-sm">Sin referencias comerciales</p>
        ) : (
          <div className="space-y-3">
            {customer.commercial_references?.map(r => (
              <div key={r.id} className="p-4 bg-gray-50 rounded-xl">
                <p className="font-semibold text-gray-900">{r.company}</p>
                {r.contact_name && <p className="text-sm text-gray-600">{r.contact_name}</p>}
                {r.phone && <p className="text-xs text-gray-400 flex items-center gap-1 mt-1"><Phone className="h-3 w-3" />{r.phone}</p>}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Referencias Bancarias" icon={<Banknote className="h-4 w-4" />}>
        {(customer.bank_references?.length ?? 0) === 0 ? (
          <p className="text-gray-400 text-sm">Sin referencias bancarias</p>
        ) : (
          <div className="space-y-3">
            {customer.bank_references?.map(r => (
              <div key={r.id} className="p-4 bg-gray-50 rounded-xl flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Banknote className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{r.bank_name}</p>
                  <p className="text-xs text-gray-400">{r.account_type_display} · {r.account_number || '—'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Avales / Codeudores" icon={<Shield className="h-4 w-4" />}>
        {(customer.guarantors?.length ?? 0) === 0 ? (
          <p className="text-gray-400 text-sm">Sin avales registrados</p>
        ) : (
          <div className="space-y-3">
            {customer.guarantors?.map((g: CustomerGuarantor) => (
              <div key={g.id} className="p-4 bg-gray-50 rounded-xl">
                <p className="font-semibold text-gray-900">{g.name}</p>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-gray-500">
                  <span>Cédula: {g.id_number}</span>
                  <span>Tel: {g.phone || '—'}</span>
                  <span>Empleo: {g.employer || '—'}</span>
                  <span>Ingresos: {fmt(g.monthly_income)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

// ─── TAB: Documentos ──────────────────────────────────────────────────────
function TabDocumentos({ customer }: { customer: Customer }) {
  const docs = customer.documents || []
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-700">{docs.length} documentos</h3>
        <button className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">
          <Plus className="h-3.5 w-3.5" /> Subir documento
        </button>
      </div>
      {docs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Sin documentos cargados</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {docs.map(d => (
            <div key={d.id} className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-primary-300 transition-colors">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${d.is_verified ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                {d.is_verified ? <CheckCircle className="h-5 w-5 text-emerald-600" /> : <FileText className="h-5 w-5 text-gray-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-900 truncate">{d.document_type_display || d.document_type}</p>
                <p className="text-xs text-gray-400">{d.file_name} · {(d.file_size / 1024).toFixed(0)} KB</p>
              </div>
              {d.is_verified && <span className="text-xs text-emerald-600 font-medium">Verificado</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── TAB: Historial ──────────────────────────────────────────────────────
function TabHistorial({ loans, fs }: { loans: unknown[]; fs?: Customer['financial_summary'] }) {
  return (
    <div className="space-y-6">
      {fs && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="Total desembolsado" value={fmt(fs.total_disbursed)} sub="" color="purple" icon={<TrendingUp className="h-4 w-4" />} />
          <KPICard label="Total pagado" value={fmt(fs.total_paid)} sub="" color="green" icon={<CheckCircle className="h-4 w-4" />} />
          <KPICard label="Pago a tiempo" value={`${fs.payment_on_time_rate}%`} sub="" color="blue" icon={<Clock className="h-4 w-4" />} />
          <KPICard label="Mora máxima" value={`${fs.max_days_past_due} días`} sub="" color={fs.max_days_past_due > 30 ? 'red' : 'amber'} icon={<AlertTriangle className="h-4 w-4" />} />
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-700">Préstamos</h3>
        </div>
        {loans.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Sin préstamos registrados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">#</th>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">Producto</th>
                  <th className="text-right px-4 py-2 text-gray-500 font-medium">Monto</th>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">Estado</th>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(loans as Record<string, unknown>[]).map((l, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs">{String(l.loan_number || '—')}</td>
                    <td className="px-4 py-2">{String(l.product_name || '—')}</td>
                    <td className="px-4 py-2 text-right font-medium">{fmt(Number(l.principal_amount))}</td>
                    <td className="px-4 py-2"><span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{String(l.status || '—')}</span></td>
                    <td className="px-4 py-2 text-gray-400">{fmtDate(String(l.disbursement_date || ''))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── TAB: Seguimiento ──────────────────────────────────────────────────────
function TabSeguimiento({ activities, customerId, onAdded }: { activities: CustomerActivity[]; customerId: string; onAdded: () => void }) {
  const [form, setForm] = useState({ activity_type: 'CALL', date: new Date().toISOString().slice(0, 16), result: 'POSITIVE', notes: '' })
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    setSaving(true)
    try {
      await customersService.addActivity(customerId, form)
      toast.success('Actividad registrada')
      setForm({ activity_type: 'CALL', date: new Date().toISOString().slice(0, 16), result: 'POSITIVE', notes: '' })
      onAdded()
    } catch {
      toast.error('Error registrando actividad')
    } finally {
      setSaving(false)
    }
  }

  const TYPE_ICONS: Record<string, React.ReactNode> = {
    CALL: <Phone className="h-4 w-4 text-blue-500" />,
    VISIT: <MapPin className="h-4 w-4 text-green-500" />,
    MEETING: <Users className="h-4 w-4 text-purple-500" />,
    NOTE: <FileText className="h-4 w-4 text-gray-500" />,
    ALERT: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  }

  return (
    <div className="space-y-6">
      <Section title="Registrar Actividad" icon={<Plus className="h-4 w-4" />}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
            <select value={form.activity_type} onChange={e => setForm(f => ({ ...f, activity_type: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="CALL">Llamada</option>
              <option value="VISIT">Visita</option>
              <option value="MEETING">Reunión</option>
              <option value="NOTE">Nota Interna</option>
              <option value="ALERT">Alerta</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Resultado</label>
            <select value={form.result} onChange={e => setForm(f => ({ ...f, result: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="POSITIVE">Positivo</option>
              <option value="NEGATIVE">Negativo</option>
              <option value="PENDING">Pendiente</option>
              <option value="NO_ANSWER">Sin respuesta</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha y hora</label>
          <input type="datetime-local" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Observaciones</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" rows={3} />
        </div>
        <button onClick={handleAdd} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-60">
          <Plus className="h-4 w-4" /> {saving ? 'Guardando...' : 'Registrar'}
        </button>
      </Section>

      <div className="space-y-3">
        {activities.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">Sin actividades registradas</p>
        ) : activities.map(a => (
          <div key={a.id} className="flex gap-3 p-4 bg-white border border-gray-200 rounded-xl">
            <div className="mt-0.5">{TYPE_ICONS[a.activity_type] || <Activity className="h-4 w-4 text-gray-400" />}</div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-gray-900">{a.activity_type_display}</span>
                <span className="text-xs text-gray-400">{fmtDate(a.date)}</span>
              </div>
              {a.notes && <p className="text-sm text-gray-600 mt-1">{a.notes}</p>}
              <div className="flex items-center gap-2 mt-1">
                {a.result && <span className={`text-xs px-2 py-0.5 rounded-full ${a.result === 'POSITIVE' ? 'bg-emerald-100 text-emerald-700' : a.result === 'NEGATIVE' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{a.result_display}</span>}
                {a.created_by_name && <span className="text-xs text-gray-400">· {a.created_by_name}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── TAB: Evaluación Crediticia ───────────────────────────────────────────
function TabEvaluacion({ evaluation, onEvaluate, evaluating, customer }: {
  evaluation: CustomerCreditEvaluation | null; onEvaluate: () => void; evaluating: boolean; customer: Customer
}) {
  const RATING_COLORS: Record<string, string> = {
    EXCELLENT: 'text-emerald-600',
    GOOD: 'text-blue-600',
    REGULAR: 'text-amber-600',
    RISKY: 'text-red-600',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-700">Score Crediticio Automático</h3>
        <button onClick={onEvaluate} disabled={evaluating} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-60">
          <Star className="h-4 w-4" /> {evaluating ? 'Calculando...' : 'Nueva Evaluación'}
        </button>
      </div>

      {evaluation ? (
        <>
          <div className="bg-white rounded-xl border-2 border-primary-100 p-6 text-center">
            <p className="text-sm text-gray-500 mb-2">Score Crediticio</p>
            <p className={`text-6xl font-black ${RATING_COLORS[evaluation.rating] || 'text-gray-700'}`}>{evaluation.score}</p>
            <p className="text-gray-400 text-sm mt-1">de 1000 puntos</p>
            <div className="w-48 h-3 bg-gray-100 rounded-full mx-auto mt-4 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${evaluation.rating === 'EXCELLENT' ? 'bg-emerald-400' : evaluation.rating === 'GOOD' ? 'bg-blue-400' : evaluation.rating === 'REGULAR' ? 'bg-amber-400' : 'bg-red-400'}`}
                style={{ width: `${(evaluation.score / 1000) * 100}%` }}
              />
            </div>
            <p className={`text-lg font-bold mt-3 ${RATING_COLORS[evaluation.rating]}`}>{evaluation.rating_display}</p>
          </div>

          {evaluation.recommended_max_amount && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
              <p className="text-sm text-emerald-700 font-medium">Monto Máximo Recomendado</p>
              <p className="text-2xl font-black text-emerald-700 mt-1">{fmt(evaluation.recommended_max_amount)}</p>
            </div>
          )}

          {evaluation.ai_summary && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-600 uppercase mb-2">Resumen IA</p>
              <p className="text-sm text-blue-800">{evaluation.ai_summary}</p>
            </div>
          )}

          {evaluation.risk_factors.length > 0 && (
            <Section title="Factores de Riesgo" icon={<AlertTriangle className="h-4 w-4" />}>
              <div className="space-y-2">
                {evaluation.risk_factors.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {f}
                  </div>
                ))}
              </div>
            </Section>
          )}

          <p className="text-xs text-gray-400 text-right">Evaluado el {fmtDate(evaluation.evaluated_at)}</p>
        </>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <Star className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin evaluación crediticia</p>
          <p className="text-sm mt-1">Ejecuta la evaluación automática para calcular el score de {customer.full_name}</p>
          <button onClick={onEvaluate} disabled={evaluating} className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60">
            {evaluating ? 'Calculando...' : 'Calcular Score'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Componentes reutilizables ────────────────────────────────────────────
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm mb-4">
        {icon}{title}
      </div>
      {children}
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{children}</div>
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value || '—'}</p>
    </div>
  )
}

const KPI_COLORS: Record<string, string> = {
  blue: 'bg-blue-50 border-blue-100',
  amber: 'bg-amber-50 border-amber-100',
  purple: 'bg-purple-50 border-purple-100',
  green: 'bg-emerald-50 border-emerald-100',
  red: 'bg-red-50 border-red-100',
}

function KPICard({ label, value, sub, color, icon }: { label: string; value: string; sub: string; color: string; icon: React.ReactNode }) {
  return (
    <div className={`rounded-xl border p-4 ${KPI_COLORS[color] || 'bg-gray-50 border-gray-100'}`}>
      <div className="flex items-center gap-2 mb-2 text-gray-500">{icon}<p className="text-xs font-medium">{label}</p></div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}
