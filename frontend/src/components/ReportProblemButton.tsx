import { useState } from 'react'
import { LifeBuoy, X, MessageCircle } from 'lucide-react'
import { useAuthStore } from '@/store/slices/authStore'

const SUPPORT_WHATSAPP = '18494422733'  // WhatsApp del proveedor (Ronny Sandoval)
const APP_VERSION = 'v1.4.1'

interface Props {
  variant?: 'inline' | 'floating'
  className?: string
}

export default function ReportProblemButton({ variant = 'inline', className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<'bug' | 'duda' | 'sugerencia' | 'cobro' | 'instalacion'>('bug')
  const user = useAuthStore(s => s.user)

  const handleSend = () => {
    const today = new Date().toLocaleString('es-DO')
    const message = [
      `Hola, tengo un problema con CredCore.`,
      ``,
      `Categoría: ${category}`,
      `Versión: ${APP_VERSION}`,
      `Fecha: ${today}`,
      `Usuario: ${user?.email || '(no logueado)'}`,
      `Pantalla: ${window.location.hash || window.location.pathname}`,
      ``,
      `Descripción del problema:`,
      description || '[describe el problema acá]',
    ].join('\n')

    const waUrl = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`
    window.open(waUrl, '_blank', 'noopener,noreferrer')
    setOpen(false)
    setDescription('')
  }

  return (
    <>
      {variant === 'floating' ? (
        <button
          onClick={() => setOpen(true)}
          title="Reportar un problema"
          className={`fixed bottom-4 right-4 z-30 flex items-center gap-2 px-3 py-2.5 bg-emerald-600 text-white rounded-full shadow-lg hover:bg-emerald-700 transition-all hover:scale-105 ${className}`}
        >
          <LifeBuoy className="h-4 w-4" />
          <span className="hidden sm:inline text-xs font-medium">Ayuda</span>
        </button>
      ) : (
        <button onClick={() => setOpen(true)}
          className={`flex items-center gap-2 text-xs text-gray-500 hover:text-emerald-600 transition-colors ${className}`}>
          <LifeBuoy className="h-3.5 w-3.5" />
          <span>Reportar problema</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LifeBuoy className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-gray-900 dark:text-gray-100">Reportar problema</h3>
              </div>
              <button onClick={() => setOpen(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Se abrirá un chat de WhatsApp con tu mensaje pre-rellenado. Antes de mandarlo puedes editarlo.
              </p>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Tipo de reporte</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {([
                    { id: 'bug', label: '🐛 Error', desc: 'Algo no funciona' },
                    { id: 'duda', label: '❓ Duda', desc: 'No sé cómo hacer algo' },
                    { id: 'sugerencia', label: '💡 Idea', desc: 'Sugerencia de mejora' },
                    { id: 'cobro', label: '💰 Cobro', desc: 'Pago no se registra' },
                    { id: 'instalacion', label: '⚙️ Instalación', desc: 'Problema al instalar' },
                  ] as const).map(c => (
                    <button key={c.id} onClick={() => setCategory(c.id)} title={c.desc}
                      className={`px-2 py-2 text-[11px] font-medium rounded-lg border transition-colors ${
                        category === c.id
                          ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Cuéntanos qué pasa</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Describe el problema, qué intentaste hacer, qué esperabas que pasara..."
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-700" />
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900 rounded-lg p-3 text-xs text-blue-800 dark:text-blue-200">
                Tu mensaje llevará automáticamente: versión, fecha, tu email y la pantalla donde estás. Esto ayuda a resolverlo más rápido.
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 flex gap-3">
              <button onClick={() => setOpen(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700">
                Cancelar
              </button>
              <button onClick={handleSend}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">
                <MessageCircle className="h-4 w-4" />
                Abrir WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
