/**
 * PWAInstallPrompt — Muestra un banner sugerente cuando el sistema se puede instalar como app.
 * Solo aparece en móviles/tablets y se puede cerrar.
 */
import { useState, useEffect } from 'react'
import { Download, X, Smartphone } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: string }>
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Ya está instalada como app
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  if (isStandalone || dismissed || !deferredPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-gray-900 text-white rounded-2xl shadow-2xl border border-gray-700 p-4 z-50 animate-slide-up">
      <button onClick={() => setDismissed(true)} className="absolute top-2 right-2 p-1 text-gray-400 hover:text-white">
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shrink-0">
          <Smartphone className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold">Instalar CredCore</p>
          <p className="text-xs text-gray-400 mt-0.5">Accede rápido desde tu pantalla de inicio</p>
          <button onClick={handleInstall}
            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-xs font-semibold rounded-lg hover:bg-primary-700 transition-colors">
            <Download className="h-3.5 w-3.5" /> Instalar App
          </button>
        </div>
      </div>
    </div>
  )
}
