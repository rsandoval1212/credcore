import { useState, useRef, useEffect, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

interface MenuItem {
  label: string
  icon?: ReactNode
  onClick: () => void
  variant?: 'default' | 'danger' | 'success'
  divider?: boolean
  disabled?: boolean
}

interface Props {
  trigger?: ReactNode
  label?: string
  items: MenuItem[]
  align?: 'left' | 'right'
  buttonClassName?: string
}

export default function DropdownMenu({ trigger, label, items, align = 'right', buttonClassName }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)}
        className={buttonClassName || `flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors`}>
        {trigger || (
          <>
            <span>{label}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>
      {open && (
        <div className={`absolute z-50 mt-1 min-w-[200px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1 ${align === 'right' ? 'right-0' : 'left-0'} animate-in fade-in zoom-in-95 duration-100`}>
          {items.map((it, i) => (
            <div key={i}>
              {it.divider && i > 0 && <div className="border-t border-gray-100 dark:border-gray-700 my-1" />}
              <button onClick={() => { if (!it.disabled) { it.onClick(); setOpen(false) } }}
                disabled={it.disabled}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  it.variant === 'danger'   ? 'text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30' :
                  it.variant === 'success'  ? 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30' :
                  'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}>
                {it.icon && <span className="shrink-0">{it.icon}</span>}
                <span>{it.label}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
