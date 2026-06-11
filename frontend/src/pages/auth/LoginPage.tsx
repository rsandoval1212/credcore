import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Loader2 } from 'lucide-react'
import { authService } from '@/services/auth'
import { useAuthStore } from '@/store/slices/authStore'
import toast from 'react-hot-toast'
import logo from '@/assets/logo.png'

interface LoginForm { email: string; password: string; totp_code?: string }

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [requires2FA, setRequires2FA] = useState(false)

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
    <div className="min-h-screen bg-gradient-to-br from-primary-900 to-primary-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={logo} alt="CredCore" className="w-28 h-28 mx-auto mb-3 object-contain" />
          <p className="text-gray-500 text-sm">Sistema de Gestión de Créditos</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
            <input
              type="email"
              className="input-field"
              placeholder="usuario@empresa.com"
              {...register('email', { required: 'El correo es requerido' })}
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              {...register('password', { required: 'La contraseña es requerida' })}
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          {requires2FA && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código 2FA</label>
              <input
                type="text"
                maxLength={6}
                className="input-field"
                placeholder="123456"
                {...register('totp_code')}
              />
            </div>
          )}

          <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  )
}
