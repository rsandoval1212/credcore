import { useState, useCallback, useRef } from 'react'
import {
  Calculator, Printer, RefreshCw, TrendingUp,
  DollarSign, Calendar, Percent, BarChart3,
  ChevronDown, Info, Sigma, RotateCcw,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface AmortRow {
  num: number
  dueDate: string
  principal: number
  interest: number
  total: number
  balance: number
}

interface CalcResult {
  monthlyPayment: number
  totalPayment: number
  totalInterest: number
  totalPrincipal: number
  rows: AmortRow[]
}

type PaymentMethod = 'french' | 'german' | 'american'
type RateType = 'monthly' | 'annual'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('es-DO', {
    style: 'currency', currency: 'DOP', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n)

const fmtN = (n: number, dec = 2) =>
  new Intl.NumberFormat('es-DO', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n)

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-DO', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ─── Motor de cálculo ─────────────────────────────────────────────────────────
function calcAmortization(
  principal: number,
  annualRate: number,   // siempre en % anual
  termMonths: number,
  method: PaymentMethod,
  startDate: string,    // fecha del primer pago
): CalcResult {
  const r = annualRate / 100 / 12  // tasa mensual decimal

  const rows: AmortRow[] = []
  let balance = principal

  if (method === 'french') {
    // Cuota fija (sistema francés)
    const pmt = r === 0
      ? principal / termMonths
      : (principal * r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1)

    for (let i = 1; i <= termMonths; i++) {
      const interest = balance * r
      const princ = i === termMonths ? balance : Math.min(pmt - interest, balance)
      balance = Math.max(0, balance - princ)
      rows.push({
        num: i,
        dueDate: addMonths(startDate, i - 1),
        principal: princ,
        interest,
        total: princ + interest,
        balance,
      })
    }
  } else if (method === 'german') {
    // Capital fijo (sistema alemán)
    const princPerPeriod = principal / termMonths
    for (let i = 1; i <= termMonths; i++) {
      const interest = balance * r
      const princ = i === termMonths ? balance : princPerPeriod
      balance = Math.max(0, balance - princ)
      rows.push({
        num: i,
        dueDate: addMonths(startDate, i - 1),
        principal: princ,
        interest,
        total: princ + interest,
        balance,
      })
    }
  } else {
    // Americano (solo intereses, capital al final)
    for (let i = 1; i <= termMonths; i++) {
      const interest = balance * r
      const isLast = i === termMonths
      const princ = isLast ? balance : 0
      balance = isLast ? 0 : balance
      rows.push({
        num: i,
        dueDate: addMonths(startDate, i - 1),
        principal: princ,
        interest,
        total: princ + interest,
        balance,
      })
    }
  }

  const totalPayment = rows.reduce((s, r) => s + r.total, 0)
  const totalInterest = rows.reduce((s, r) => s + r.interest, 0)
  const monthlyPayment = method === 'french' ? rows[0].total : rows[0].total  // primera cuota de referencia

  return { monthlyPayment, totalPayment, totalInterest, totalPrincipal: principal, rows }
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  const colors: Record<string, string> = {
    blue:   'bg-blue-50 border-blue-100 text-blue-600',
    green:  'bg-emerald-50 border-emerald-100 text-emerald-600',
    amber:  'bg-amber-50 border-amber-100 text-amber-600',
    purple: 'bg-purple-50 border-purple-100 text-purple-600',
    red:    'bg-red-50 border-red-100 text-red-600',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-xl font-black">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Tooltip de método ────────────────────────────────────────────────────────
const METHOD_DESC: Record<PaymentMethod, string> = {
  french:   'Cuota fija todos los meses (la más común). El capital aumenta y el interés disminuye cada período.',
  german:   'Capital constante. Las cuotas disminuyen cada mes. Se paga menos interés en total.',
  american: 'Solo intereses durante el plazo; el capital total se paga en la última cuota.',
}

// ─── Calculadora de Interés Simple A=P(1+rt) ─────────────────────────────────
function SimpleInterestCalc() {
  const [P, setP] = useState('100000')
  const [r, setR] = useState('24')
  const [t, setT] = useState('12')
  const [tUnit, setTUnit] = useState<'months' | 'years'>('months')

  const principal = parseFloat(P) || 0
  const rate      = parseFloat(r) || 0
  const time      = parseFloat(t) || 0
  const timeYears = tUnit === 'months' ? time / 12 : time
  const A   = principal * (1 + (rate / 100) * timeYears)
  const I   = A - principal
  const fmtN = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 2 }).format(n)

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-3">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
          <Sigma className="h-4 w-4" />
          Interés Simple — A = P(1 + rt)
        </h3>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Capital (P) RD$</label>
            <input type="number" value={P} onChange={e => setP(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Tasa anual (r) %</label>
            <input type="number" value={r} onChange={e => setR(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Tiempo (t)</label>
            <div className="flex gap-1">
              <input type="number" value={t} onChange={e => setT(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              <select value={tUnit} onChange={e => setTUnit(e.target.value as 'months'|'years')}
                className="px-2 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none bg-gray-50">
                <option value="months">meses</option>
                <option value="years">años</option>
              </select>
            </div>
          </div>
        </div>

        {principal > 0 && rate > 0 && time > 0 && (
          <div className="grid grid-cols-3 gap-4 mt-2">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Capital (P)</p>
              <p className="text-lg font-black text-gray-900">{fmtN(principal)}</p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Interés (I = Prt)</p>
              <p className="text-lg font-black text-blue-700">{fmtN(I)}</p>
            </div>
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Monto Final (A)</p>
              <p className="text-lg font-black text-purple-700">{fmtN(A)}</p>
            </div>
          </div>
        )}

        <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 font-mono text-center">
          A = {fmtN(principal)} × (1 + ({rate}% ÷ 100) × {timeYears.toFixed(4)}) = <strong className="text-gray-900">{fmtN(A)}</strong>
        </div>
      </div>
    </div>
  )
}

// ─── Calculadora de Penalidades y Mora ────────────────────────────────────────
function PenaltyCalc() {
  const [capital, setCapital] = useState('100000')
  const [dayRate, setDayRate] = useState('0.10')
  const [days, setDays]       = useState('30')
  const fmtN = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 2 }).format(n)
  const cap  = parseFloat(capital) || 0
  const rate = parseFloat(dayRate) || 0
  const d    = parseInt(days) || 0
  const penalty = cap * (rate / 100) * d

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-red-600 to-red-500 px-5 py-3">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
          <Percent className="h-4 w-4" />
          Cálculo de Mora / Penalidad
        </h3>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Capital en mora (RD$)</label>
            <input type="number" value={capital} onChange={e => setCapital(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Tasa mora diaria (%)</label>
            <input type="number" step="0.01" value={dayRate} onChange={e => setDayRate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Días de atraso</label>
            <input type="number" value={days} onChange={e => setDays(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
          </div>
        </div>
        {cap > 0 && rate > 0 && d > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Capital</p>
              <p className="text-lg font-black text-gray-900">{fmtN(cap)}</p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Penalidad ({d} días)</p>
              <p className="text-lg font-black text-red-700">{fmtN(penalty)}</p>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Total a pagar</p>
              <p className="text-lg font-black text-orange-700">{fmtN(cap + penalty)}</p>
            </div>
          </div>
        )}
        <p className="text-xs text-gray-400 text-center">
          Fórmula: Mora = Capital × (Tasa% / 100) × Días
        </p>
      </div>
    </div>
  )
}

// ─── Calculadora de Refinanciamiento ─────────────────────────────────────────
function RefinancingCalc() {
  const [balance, setBalance]     = useState('50000')
  const [arrears, setArrears]     = useState('5000')
  const [newRate, setNewRate]     = useState('20')
  const [newTerm, setNewTerm]     = useState('18')

  const fmtN = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 2 }).format(n)
  const balanceN = parseFloat(balance) || 0
  const arrearsN = parseFloat(arrears) || 0
  const rate     = parseFloat(newRate) || 0
  const term     = parseInt(newTerm) || 1
  const newPrincipal = balanceN + arrearsN
  const r = rate / 100 / 12
  const newPayment = r > 0
    ? newPrincipal * r / (1 - Math.pow(1 + r, -term))
    : newPrincipal / term
  const totalNew = newPayment * term
  const totalInterestNew = totalNew - newPrincipal

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-violet-600 to-violet-500 px-5 py-3">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
          <RotateCcw className="h-4 w-4" />
          Simulación de Refinanciamiento
        </h3>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Saldo pendiente (RD$)</label>
            <input type="number" value={balance} onChange={e => setBalance(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Atrasos a capitalizar (RD$)</label>
            <input type="number" value={arrears} onChange={e => setArrears(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nueva tasa anual (%)</label>
            <input type="number" value={newRate} onChange={e => setNewRate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nuevo plazo (meses)</label>
            <input type="number" value={newTerm} onChange={e => setNewTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
          </div>
        </div>

        {newPrincipal > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Nuevo capital</p>
              <p className="font-black text-violet-700">{fmtN(newPrincipal)}</p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Nueva cuota</p>
              <p className="font-black text-blue-700">{fmtN(newPayment)}</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Total intereses</p>
              <p className="font-black text-amber-700">{fmtN(totalInterestNew)}</p>
            </div>
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Total a pagar</p>
              <p className="font-black text-purple-700">{fmtN(totalNew)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
const CALC_TABS = [
  { id: 'amort',    label: 'Amortización',     icon: BarChart3 },
  { id: 'simple',   label: 'Interés Simple',   icon: Sigma },
  { id: 'penalty',  label: 'Mora / Penalidad', icon: Percent },
  { id: 'refi',     label: 'Refinanciamiento', icon: RotateCcw },
]

export default function LoanCalculatorPage() {
  const [calcTab, setCalcTab] = useState<'amort'|'simple'|'penalty'|'refi'>('amort')

  // Formulario amortización
  const today = new Date().toISOString().slice(0, 10)
  const [principal, setPrincipal]     = useState('100000')
  const [rate, setRate]               = useState('24')
  const [rateType, setRateType]       = useState<RateType>('annual')
  const [term, setTerm]               = useState('12')
  const [method, setMethod]           = useState<PaymentMethod>('french')
  const [startDate, setStartDate]     = useState(today)
  const [showInfo, setShowInfo]       = useState(false)

  // Resultado amortización
  const [result, setResult]           = useState<CalcResult | null>(null)
  const [error, setError]             = useState('')
  const [calculating, setCalculating] = useState(false)

  // Imprimir
  const printRef = useRef<HTMLDivElement>(null)

  const handleCalc = useCallback(() => {
    setError('')
    const p = parseFloat(principal.replace(/,/g, ''))
    const r = parseFloat(rate)
    const t = parseInt(term)

    if (!p || p <= 0)    { setError('El monto debe ser mayor a 0'); return }
    if (!r || r <= 0)    { setError('La tasa debe ser mayor a 0'); return }
    if (!t || t <= 0 || t > 600) { setError('El plazo debe ser entre 1 y 600 meses'); return }
    if (!startDate)      { setError('Selecciona la fecha del primer pago'); return }

    setCalculating(true)
    setTimeout(() => {
      try {
        const annualRate = rateType === 'monthly' ? r * 12 : r
        const res = calcAmortization(p, annualRate, t, method, startDate)
        setResult(res)
      } catch {
        setError('Error en el cálculo. Verifica los datos.')
      } finally {
        setCalculating(false)
      }
    }, 150)
  }, [principal, rate, rateType, term, method, startDate])

  const handleReset = () => {
    setPrincipal('100000')
    setRate('24')
    setRateType('annual')
    setTerm('12')
    setMethod('french')
    setStartDate(today)
    setResult(null)
    setError('')
  }

  const handlePrint = () => {
    const content = printRef.current
    if (!content) return
    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) return
    w.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8"/>
        <title>Tabla de Amortización — CredCore</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 24px; }
          h1 { font-size: 18px; font-weight: 800; margin-bottom: 4px; }
          .subtitle { color: #555; font-size: 11px; margin-bottom: 16px; }
          .params { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 20px; padding: 12px; background: #f5f7fb; border-radius: 8px; }
          .param-item { }
          .param-label { font-size: 9px; font-weight: 700; color: #888; text-transform: uppercase; }
          .param-value { font-size: 13px; font-weight: 800; color: #1a1a1a; }
          .kpis { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 20px; }
          .kpi { padding: 10px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; text-align:center; }
          .kpi-label { font-size: 9px; color: #888; margin-bottom: 3px; }
          .kpi-value { font-size: 13px; font-weight: 800; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          thead tr { background: #1e3a5f; color: white; }
          th { padding: 6px 8px; text-align: right; font-size: 10px; font-weight: 700; }
          th:first-child { text-align: center; }
          th:nth-child(2) { text-align: left; }
          td { padding: 5px 8px; text-align: right; font-size: 10px; border-bottom: 1px solid #f0f0f0; }
          td:first-child { text-align: center; color: #888; }
          td:nth-child(2) { text-align: left; }
          tr:nth-child(even) td { background: #f9fafb; }
          tfoot tr td { background: #eef2f7; font-weight: 800; border-top: 2px solid #1e3a5f; }
          .footer { margin-top: 20px; font-size: 9px; color: #aaa; text-align: center; }
          @media print { body { padding: 12px; } }
        </style>
      </head>
      <body>
        ${content.innerHTML}
        <div class="footer">Generado por CredCore · ${new Date().toLocaleDateString('es-DO', { day:'2-digit', month:'long', year:'numeric' })}</div>
      </body>
      </html>
    `)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 400)
  }

  const annualRateDisplay = rateType === 'monthly'
    ? (parseFloat(rate || '0') * 12).toFixed(2)
    : (parseFloat(rate || '0')).toFixed(2)

  const monthlyRateDisplay = rateType === 'monthly'
    ? (parseFloat(rate || '0')).toFixed(4)
    : (parseFloat(rate || '0') / 12).toFixed(4)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Calculator className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Calculadora Financiera</h1>
              <p className="text-xs text-gray-400">Amortización, interés simple, mora y refinanciamientos</p>
            </div>
          </div>
          {result && calcTab === 'amort' && (
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
              <Printer className="h-4 w-4" />
              Imprimir Tabla
            </button>
          )}
        </div>
        {/* Tabs de calculadora */}
        <div className="flex gap-1">
          {CALC_TABS.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => setCalcTab(t.id as typeof calcTab)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                  calcTab === t.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                <Icon className="h-3.5 w-3.5" />{t.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Tabs extra */}
          {calcTab === 'simple'  && <SimpleInterestCalc />}
          {calcTab === 'penalty' && <PenaltyCalc />}
          {calcTab === 'refi'    && <RefinancingCalc />}

          {/* ── Panel de amortización (solo si tab = amort) ────────────────── */}
          {calcTab === 'amort' && <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-6 py-4">
              <h2 className="text-white font-semibold text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Parámetros del Préstamo
              </h2>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

                {/* Monto */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    <DollarSign className="inline h-3.5 w-3.5 mr-1" />Monto del Préstamo
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">RD$</span>
                    <input
                      type="number" min="0" step="1000" value={principal}
                      onChange={e => setPrincipal(e.target.value)}
                      className="w-full pl-12 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                      placeholder="100,000"
                    />
                  </div>
                </div>

                {/* Tasa */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    <Percent className="inline h-3.5 w-3.5 mr-1" />Tasa de Interés
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number" min="0.01" step="0.01" max="999" value={rate}
                        onChange={e => setRate(e.target.value)}
                        className="w-full pr-8 pl-3 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        placeholder="24"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                    </div>
                    <select value={rateType} onChange={e => setRateType(e.target.value as RateType)}
                      className="border border-gray-200 rounded-xl text-xs px-2 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50 font-medium cursor-pointer">
                      <option value="annual">Anual</option>
                      <option value="monthly">Mensual</option>
                    </select>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    ≈ {annualRateDisplay}% anual · {monthlyRateDisplay}% mensual
                  </p>
                </div>

                {/* Plazo */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    <Calendar className="inline h-3.5 w-3.5 mr-1" />Plazo
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number" min="1" max="600" value={term}
                      onChange={e => setTerm(e.target.value)}
                      className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      placeholder="12"
                    />
                    <div className="flex flex-col gap-1">
                      <button onClick={() => setTerm(String(Math.max(1, parseInt(term || '0') - 1)))}
                        className="px-3 py-1 bg-gray-100 rounded-lg text-xs hover:bg-gray-200 font-bold leading-none">−</button>
                      <button onClick={() => setTerm(String(parseInt(term || '0') + 1))}
                        className="px-3 py-1 bg-gray-100 rounded-lg text-xs hover:bg-gray-200 font-bold leading-none">+</button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {term && parseInt(term) > 0 ? `${parseInt(term)} meses = ${(parseInt(term) / 12).toFixed(1)} años` : ''}
                  </p>
                </div>

                {/* Fecha primer pago */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    <Calendar className="inline h-3.5 w-3.5 mr-1" />Fecha Primer Pago
                  </label>
                  <input
                    type="date" value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>

                {/* Método */}
                <div className="lg:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5" />Método de Amortización
                    <button onClick={() => setShowInfo(v => !v)}
                      className="ml-1 text-gray-400 hover:text-indigo-500 transition-colors">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { id: 'french',   label: 'Francés',   sub: 'Cuota fija' },
                      { id: 'german',   label: 'Alemán',    sub: 'Capital fijo' },
                      { id: 'american', label: 'Americano', sub: 'Bullet' },
                    ] as const).map(m => (
                      <button key={m.id} onClick={() => setMethod(m.id)}
                        className={`px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                          method === m.id
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                        }`}>
                        <div className="font-semibold">{m.label}</div>
                        <div className="text-xs opacity-60">{m.sub}</div>
                      </button>
                    ))}
                  </div>
                  {showInfo && (
                    <div className="mt-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-700">
                      <ChevronDown className="inline h-3 w-3 mr-1" />
                      {METHOD_DESC[method]}
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  ⚠️ {error}
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3 mt-6">
                <button onClick={handleCalc} disabled={calculating}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors shadow-sm text-sm">
                  {calculating
                    ? <><RefreshCw className="h-4 w-4 animate-spin" /> Calculando...</>
                    : <><Calculator className="h-4 w-4" /> Calcular Préstamo</>}
                </button>
                <button onClick={handleReset}
                  className="px-5 py-3 border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50 text-sm font-medium transition-colors">
                  Limpiar
                </button>
              </div>
            </div>
          </div>}  {/* fin panel amort */}

          {/* ── Resultados (solo tab amort) ───────────────────────────────── */}
          {calcTab === 'amort' && result && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                  label="Cuota de Referencia"
                  value={fmt(result.rows[0].total)}
                  sub={method === 'french' ? 'Cuota fija mensual' : method === 'german' ? '1ra cuota (decrece)' : 'Solo intereses c/mes'}
                  color="blue"
                />
                <KPICard
                  label="Total a Pagar"
                  value={fmt(result.totalPayment)}
                  sub={`Capital + intereses`}
                  color="purple"
                />
                <KPICard
                  label="Total Intereses"
                  value={fmt(result.totalInterest)}
                  sub={`${((result.totalInterest / result.totalPrincipal) * 100).toFixed(1)}% sobre el capital`}
                  color="amber"
                />
                <KPICard
                  label="Costo Total del Crédito"
                  value={`${((result.totalInterest / result.totalPrincipal) * 100).toFixed(2)}%`}
                  sub={`CAT sobre capital`}
                  color="green"
                />
              </div>

              {/* Resumen comparativo visual */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-indigo-500" />Distribución del Préstamo
                </h3>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${(result.totalPrincipal / result.totalPayment) * 100}%` }}
                    />
                    <div
                      className="h-full bg-amber-400"
                      style={{ width: `${(result.totalInterest / result.totalPayment) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="flex gap-6 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-full bg-indigo-500" />
                    Capital: {fmt(result.totalPrincipal)} ({((result.totalPrincipal / result.totalPayment) * 100).toFixed(1)}%)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-full bg-amber-400" />
                    Intereses: {fmt(result.totalInterest)} ({((result.totalInterest / result.totalPayment) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>

              {/* ── Tabla de amortización ─────────────────────────────────── */}
              {/* Este div es el que se imprime */}
              <div ref={printRef}>
                {/* Encabezado solo visible al imprimir */}
                <div className="print-only" style={{ display: 'none' }}>
                  <h1>Tabla de Amortización</h1>
                  <p className="subtitle">Sistema CredCore</p>
                  <div className="params">
                    <div className="param-item">
                      <div className="param-label">Monto</div>
                      <div className="param-value">{fmt(result.totalPrincipal)}</div>
                    </div>
                    <div className="param-item">
                      <div className="param-label">Tasa Anual</div>
                      <div className="param-value">{annualRateDisplay}%</div>
                    </div>
                    <div className="param-item">
                      <div className="param-label">Plazo</div>
                      <div className="param-value">{term} meses</div>
                    </div>
                    <div className="param-item">
                      <div className="param-label">Método</div>
                      <div className="param-value">{method === 'french' ? 'Francés' : method === 'german' ? 'Alemán' : 'Americano'}</div>
                    </div>
                  </div>
                  <div className="kpis">
                    <div className="kpi">
                      <div className="kpi-label">Cuota de Referencia</div>
                      <div className="kpi-value">{fmt(result.rows[0].total)}</div>
                    </div>
                    <div className="kpi">
                      <div className="kpi-label">Total a Pagar</div>
                      <div className="kpi-value">{fmt(result.totalPayment)}</div>
                    </div>
                    <div className="kpi">
                      <div className="kpi-label">Total Intereses</div>
                      <div className="kpi-value">{fmt(result.totalInterest)}</div>
                    </div>
                    <div className="kpi">
                      <div className="kpi-label">Primer Pago</div>
                      <div className="kpi-value">{fmtDate(startDate)}</div>
                    </div>
                  </div>
                </div>

                {/* Tabla visible en pantalla */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-indigo-500" />
                      Tabla de Amortización
                      <span className="ml-1 text-xs font-normal text-gray-400">
                        {result.rows.length} cuotas · {method === 'french' ? 'Sistema Francés' : method === 'german' ? 'Sistema Alemán' : 'Sistema Americano'}
                      </span>
                    </h3>
                    <div className="flex gap-2 text-xs text-gray-500">
                      <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg font-medium">
                        {fmt(result.totalPrincipal)} capital
                      </span>
                      <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-lg font-medium">
                        {fmt(result.totalInterest)} intereses
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="text-center px-3 py-3 font-semibold text-gray-500 text-xs w-12">#</th>
                          <th className="text-left px-3 py-3 font-semibold text-gray-500 text-xs">Vencimiento</th>
                          <th className="text-right px-3 py-3 font-semibold text-gray-500 text-xs">Capital</th>
                          <th className="text-right px-3 py-3 font-semibold text-gray-500 text-xs">Interés</th>
                          <th className="text-right px-3 py-3 font-semibold text-gray-500 text-xs">Cuota Total</th>
                          <th className="text-right px-3 py-3 font-semibold text-gray-500 text-xs">Saldo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {result.rows.map(row => (
                          <tr key={row.num} className="hover:bg-indigo-50/30 transition-colors">
                            <td className="px-3 py-2.5 text-center text-gray-400 text-xs font-mono">{row.num}</td>
                            <td className="px-3 py-2.5 text-gray-700 text-xs">{fmtDate(row.dueDate)}</td>
                            <td className="px-3 py-2.5 text-right text-gray-700 text-xs">{fmtN(row.principal)}</td>
                            <td className="px-3 py-2.5 text-right text-amber-600 text-xs">{fmtN(row.interest)}</td>
                            <td className="px-3 py-2.5 text-right font-bold text-gray-900 text-xs">{fmtN(row.total)}</td>
                            <td className="px-3 py-2.5 text-right text-gray-500 text-xs">{fmtN(row.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-indigo-50 border-t-2 border-indigo-200">
                          <td colSpan={2} className="px-3 py-3 text-xs font-black text-indigo-700 uppercase">TOTALES</td>
                          <td className="px-3 py-3 text-right text-xs font-black text-indigo-700">{fmtN(result.totalPrincipal)}</td>
                          <td className="px-3 py-3 text-right text-xs font-black text-amber-600">{fmtN(result.totalInterest)}</td>
                          <td className="px-3 py-3 text-right text-xs font-black text-indigo-900">{fmtN(result.totalPayment)}</td>
                          <td className="px-3 py-3 text-right text-xs font-black text-gray-400">—</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>

              {/* Nota pie de página */}
              <div className="text-center text-xs text-gray-400 pb-2">
                Calculadora de uso orientativo. Los valores pueden variar según condiciones específicas del producto.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
