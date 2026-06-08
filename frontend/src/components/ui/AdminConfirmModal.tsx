/**
 * AdminConfirmModal
 * Solicita la contraseña del administrador antes de permitir una operación sensible.
 * Se usa cuando un usuario sin rol de admin intenta hacer cambios críticos.
 *
 * Uso:
 *   <AdminConfirmModal
 *     action="Condonar mora de RD$500"
 *     onConfirmed={() => doSensitiveAction()}
 *     onClose={() => setShow(false)}
 *   />
 */
import { useState, useEffect, useRef } from 'react'
import { ShieldAlert, Eye, EyeOff, X, Loader2, CheckCircle } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'

interface Props {
  /** Descripción de la acción que se está autorizando */
  action: string
  /** Callback cuando la verificación es exitosa */
  onConfirmed: () => void
  /** Cerrar el modal sin confirmar */
  onClose: () => void
}

export default function AdminConfirmModal({ action, onConfirmed, onClose }: Props) {
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPass, setAdminPass]   = useState('')
  const [showPass, setShowPass]     = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  const handleVerify = async () => {
    if (!adminEmail.trim()) { setError('Ingresa el email del administrador'); return }
    if (!adminPass)          { setError('Ingresa la contraseña'); return }
    setError('')
    setLoading(true)
    try {
      const r = await api.post('/auth/auth/verify_admin/', {
        admin_email: adminEmail,
        admin_password: adminPass,
      })
      if (r.data.verified) {
        toast.success(`Autorizado por ${r.data.admin_name}`, { icon: '✅', duration: 2500 })
        onConfirmed()
        onClose()
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err.response?.data?.detail || 'Verificación fallida')
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleVerify()
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onKeyDown={handleKey}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm">Autorización requerida</h2>
              <p className="text-xs text-gray-400">Se requiere aprobación de administrador</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Acción que se está autorizando */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-amber-700 mb-1">Acción a autorizar:</p>
            <p className="text-sm text-amber-900 font-medium">{action}</p>
          </div>

          {/* Email admin */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Email del Administrador
            </label>
            <input
              ref={inputRef}
              type="email"
              value={adminEmail}
              onChange={e => { setAdminEmail(e.target.value); setError('') }}
              placeholder="admin@empresa.com"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
          </div>

          {/* Contraseña */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Contraseña del Administrador
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={adminPass}
                onChange={e => { setAdminPass(e.target.value); setError('') }}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
          <button
            onClick={handleVerify}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 disabled:opacity-60 transition-colors text-sm"
          >
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" />Verificando...</>
              : <><CheckCircle className="h-4 w-4" />Autorizar</>}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
