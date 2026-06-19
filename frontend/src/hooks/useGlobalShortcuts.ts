import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Atajos de teclado globales:
 *  Ctrl+/  → abrir buscador (foco al input con [data-global-search])
 *  Ctrl+K  → mismo que Ctrl+/
 *  Ctrl+H  → Inicio
 *  Ctrl+B  → Clientes (Base de datos)
 *  Ctrl+L  → Préstamos
 *  Ctrl+P  → Cobros
 *  Ctrl+M  → Calendario (mensual)
 *  Esc     → cerrar modales abiertos (dispatch evento 'app:close-modal')
 */
export function useGlobalShortcuts() {
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      const inTextField = tag === 'input' || tag === 'textarea' || target?.isContentEditable

      if (e.key === 'Escape' && !inTextField) {
        window.dispatchEvent(new CustomEvent('app:close-modal'))
        return
      }

      if (!(e.ctrlKey || e.metaKey)) return

      switch (e.key.toLowerCase()) {
        case '/':
        case 'k': {
          e.preventDefault()
          const input = document.querySelector<HTMLInputElement>('[data-global-search]')
          input?.focus()
          input?.select()
          break
        }
        case 'h': e.preventDefault(); navigate('/dashboard'); break
        case 'b': e.preventDefault(); navigate('/customers'); break
        case 'l': e.preventDefault(); navigate('/loans'); break
        case 'p':
          if (!inTextField) { e.preventDefault(); navigate('/payments') }
          break
        case 'm': e.preventDefault(); navigate('/calendar'); break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])
}
