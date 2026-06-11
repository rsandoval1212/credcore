import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  Loader2, Mail, Lock, Eye, EyeOff, ShieldCheck,
  TrendingUp, Wallet, BarChart3, KeyRound,
} from 'lucide-react'
import { authService } from '@/services/auth'
import { useAuthStore } from '@/store/slices/authStore'
import toast from 'react-hot-toast'
import logo from '@/assets/logo.png'

interface LoginForm { email: string; password: string; totp_code?: string }

const FEATURES = [
  { icon: Wallet,     title: 'Gestión de Préstamos', desc: 'Control total de tu cartera de créditos' },
  { icon: TrendingUp, title: 'Cobros y Caja',         desc: 'Registra pagos y sesiones al instante' },
  { icon: BarChart3,  title: 'Reportes en Tiempo Real', desc: 'Métricas y exportación profesional' },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [requires2FA, setRequires2FA] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>()

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    try {
      const response = await authService.login(data.email, data.password, data.totp_code)
      setAuth(response.data.user, response.data.access, response.data.refresh)
      toast.success(`Bienvenido, ${response.data.user.first_name}`)
      navigate('/dashboard')
    } catch (error: any) {
      const err = error.response?.data?.errors
      if (err?.totp_code) {
        setRequires2FA(true)
      } else {
        toast.error(err?.non_field_errors?.[0] || 'Error al iniciar sesión')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-50">

      {/* ── Panel de marca (izquierda) ─────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[46%] relative overflow-hidden
                      bg-gradient-to-br from-[#0c2138] via-[#13345c] to-[#0a1d33]">
        {/* Blobs decorativos */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute top-1/3 -right-24 w-96 h-96 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -bottom-32 left-1/4 w-96 h-96 rounded-full bg-cyan-400/10 blur-3xl" />
        {/* Patrón de cuadrícula sutil */}
        <div className="absolute inset-0 opacity-[0.04]"
             style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-2xl p-2.5 shadow-lg">
              <img src={logo} alt="CredCore" className="h-10 w-10 object-contain" />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight">CredCore</p>
              <p className="text-xs text-blue-200/80">Sistema de Préstamos</p>
            </div>
          </div>

          {/* Mensaje central */}
          <div className="space-y-8 max-w-md">
            <div>
              <h1 className="text-4xl font-bold leading-tight">
                Gestiona tus créditos<br />
                <span className="text-emerald-300">de forma profesional</span>
              </h1>
              <p className="mt-4 text-blue-100/70 text-base leading-relaxed">
                La plataforma todo-en-uno para administrar préstamos, cobros,
                caja y reportes desde un solo lugar.
              </p>
            </div>

            {/* Características */}
            <div className="space-y-4">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3.5">
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm
                                  border border-white/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-emerald-300" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{title}</p>
                    <p className="text-xs text-blue-100/60">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pie */}
          <div className="flex items-center gap-2 text-xs text-blue-200/50">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Conexión segura · Datos cifrados localmente</span>
          </div>
        </div>
      </div>

      {/* ── Formulario (derecha) ───────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">

          {/* Logo móvil (solo cuando el panel está oculto) */}
          <div className="lg:hidden text-center mb-8">
            <img src={logo} alt="CredCore" className="h-20 w-20 mx-auto object-contain" />
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-900">Bienvenido</h2>
            <p className="text-slate-500 mt-1.5">Inicia sesión para continuar a tu panel</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Correo electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="email"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50
                             text-slate-900 placeholder:text-slate-400
                             focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:bg-white
                             transition-all"
                  placeholder="usuario@empresa.com"
                  {...register('email', { required: 'El correo es requerido' })}
                />
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1.5">{errors.email.message}</p>}
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  className="w-full pl-11 pr-11 py-3 rounded-xl border border-slate-200 bg-slate-50/50
                             text-slate-900 placeholder:text-slate-400
                             focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:bg-white
                             transition-all"
                  placeholder="••••••••"
                  {...register('password', { required: 'La contraseña es requerida' })}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1.5">{errors.password.message}</p>}
            </div>

            {/* 2FA */}
            {requires2FA && (
              <div className="animate-in fade-in slide-in-from-top-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Código de verificación (2FA)</label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    maxLength={6}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50
                               text-slate-900 placeholder:text-slate-400 tracking-[0.4em] font-mono
                               focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:bg-white"
                    placeholder="123456"
                    {...register('totp_code')}
                  />
                </div>
              </div>
            )}

            {/* Botón */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-semibold
                         bg-gradient-to-r from-primary-600 to-primary-700
                         hover:from-primary-700 hover:to-primary-800
                         shadow-lg shadow-primary-600/25
                         disabled:opacity-60 disabled:cursor-not-allowed
                         transition-all active:scale-[0.99]"
            >
              {loading && <Loader2 className="h-5 w-5 animate-spin" />}
              {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </button>
          </form>

          {/* Pie */}
          <p className="text-center text-xs text-slate-400 mt-8">
            CredCore v1.0.0 · © {new Date().getFullYear()} · Desarrollado por Ronny Sandoval
          </p>
        </div>
      </div>
    </div>
  )
}
