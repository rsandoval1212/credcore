import type { ReactNode } from 'react'

export interface Chip {
  id: string
  label: string
  icon?: ReactNode
  color?: 'red' | 'amber' | 'emerald' | 'blue' | 'purple' | 'gray'
  active?: boolean
}

interface Props {
  chips: Chip[]
  activeId: string | null
  onChange: (id: string | null) => void
  className?: string
}

const COLORS: Record<NonNullable<Chip['color']>, { active: string; inactive: string }> = {
  red: {
    active: 'bg-red-600 text-white border-red-600',
    inactive: 'border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
  },
  amber: {
    active: 'bg-amber-600 text-white border-amber-600',
    inactive: 'border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20',
  },
  emerald: {
    active: 'bg-emerald-600 text-white border-emerald-600',
    inactive: 'border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
  },
  blue: {
    active: 'bg-blue-600 text-white border-blue-600',
    inactive: 'border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20',
  },
  purple: {
    active: 'bg-purple-600 text-white border-purple-600',
    inactive: 'border-purple-200 dark:border-purple-900 text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20',
  },
  gray: {
    active: 'bg-gray-700 text-white border-gray-700',
    inactive: 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700',
  },
}

export default function FilterChips({ chips, activeId, onChange, className = '' }: Props) {
  return (
    <div className={`flex gap-1.5 flex-wrap ${className}`}>
      {chips.map(c => {
        const isActive = c.id === activeId
        const palette = COLORS[c.color || 'gray']
        return (
          <button
            key={c.id}
            onClick={() => onChange(isActive ? null : c.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-1.5 rounded-full transition-all ${
              isActive ? palette.active : palette.inactive
            } border`}
          >
            {c.icon && <span className="text-xs">{c.icon}</span>}
            {c.label}
          </button>
        )
      })}
      {activeId && (
        <button onClick={() => onChange(null)}
          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5">
          ✕ Limpiar
        </button>
      )}
    </div>
  )
}
