/**
 * Componente reutilizable de filtro por rango de fechas.
 * Incluye chips de acceso rápido (Hoy, Esta semana, Este mes, etc.)
 * y campos de fecha personalizados.
 */
import { useState } from 'react'
import { Calendar, X } from 'lucide-react'

export interface DateRange {
  from: string  // YYYY-MM-DD
  to: string    // YYYY-MM-DD
}

interface Props {
  value: DateRange | null
  onChange: (range: DateRange | null) => void
  className?: string
}

/** Helpers para calcular rangos */
function today(): string {
  return new Date().toISOString().slice(0, 10)
}
function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
function firstOfMonth(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
function firstOfLastMonth(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 10)
}
function lastOfLastMonth(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 0).toISOString().slice(0, 10)
}

const PRESETS: { label: string; range: () => DateRange }[] = [
  { label: 'Hoy',          range: () => ({ from: today(), to: today() }) },
  { label: 'Ayer',         range: () => ({ from: daysAgo(1), to: daysAgo(1) }) },
  { label: 'Esta semana',  range: () => ({ from: daysAgo(new Date().getDay()), to: today() }) },
  { label: 'Este mes',     range: () => ({ from: firstOfMonth(), to: today() }) },
  { label: 'Mes pasado',   range: () => ({ from: firstOfLastMonth(), to: lastOfLastMonth() }) },
  { label: 'Ult. 90 dias', range: () => ({ from: daysAgo(90), to: today() }) },
]

export default function DateRangeFilter({ value, onChange, className = '' }: Props) {
  const [showCustom, setShowCustom] = useState(false)
  const [customFrom, setCustomFrom] = useState(value?.from || '')
  const [customTo, setCustomTo] = useState(value?.to || '')

  const activePreset = value
    ? PRESETS.find(p => {
        const r = p.range()
        return r.from === value.from && r.to === value.to
      })?.label
    : null

  const applyCustom = () => {
    if (customFrom && customTo) {
      onChange({ from: customFrom, to: customTo })
      setShowCustom(false)
    }
  }

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {/* Preset chips */}
      {PRESETS.map(p => (
        <button
          key={p.label}
          onClick={() => {
            const r = p.range()
            if (activePreset === p.label) {
              onChange(null)
            } else {
              onChange(r)
              setCustomFrom(r.from)
              setCustomTo(r.to)
            }
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            activePreset === p.label
              ? 'bg-primary-600 text-white border-primary-600'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
          }`}
        >
          {p.label}
        </button>
      ))}

      {/* Custom date toggle */}
      <button
        onClick={() => setShowCustom(!showCustom)}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
          value && !activePreset
            ? 'bg-primary-600 text-white border-primary-600'
            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
        }`}
      >
        <Calendar className="h-3 w-3" />
        {value && !activePreset ? `${value.from} a ${value.to}` : 'Personalizado'}
      </button>

      {/* Clear button */}
      {value && (
        <button
          onClick={() => { onChange(null); setCustomFrom(''); setCustomTo('') }}
          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title="Quitar filtro de fecha"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Custom date inputs */}
      {showCustom && (
        <div className="flex items-center gap-2 ml-1">
          <input
            type="date"
            value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
            className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
          <span className="text-xs text-gray-400">a</span>
          <input
            type="date"
            value={customTo}
            onChange={e => setCustomTo(e.target.value)}
            className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
          <button
            onClick={applyCustom}
            disabled={!customFrom || !customTo}
            className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 disabled:opacity-40"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  )
}
