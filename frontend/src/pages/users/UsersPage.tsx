import { useState, useEffect, useCallback } from 'react'
import {
  Users, Search, RefreshCw, Shield, UserCheck, UserX,
  Plus, Edit3, Key, X, Save, Eye, EyeOff, CheckCircle,
} from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { extractApiError } from '@/utils/apiError'
import { useAuthStore } from '@/store/slices/authStore'

interface UserItem {
  id: string; full_name: string; first_name: string; last_name: string
  email: string; username: string; phone: string
  is_active: boolean; is_staff: boolean; is_superuser: boolean
  roles: { id: number; name: string }[]
  branch: number | null; branch_name?: string; date_joined: string
}
interface Role { id: number; name: string; description: string }
interface Branch { id: number; name: string }

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
const fmtDate = (d?: string) => !d ? '—' : new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })

// ─── Modal: Crear / Editar usuario ───────────────────────────────────────────
function UserFormModal({ user, roles, branches, onClose, onSaved }: {
  user?: UserItem; roles: Role[]; branches: Branch[]
  onClose: () => void; onSaved: () => void
}) {
  const isEdit = !!user
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name:  user?.last_name  || '',
    email:      user?.email      || '',
    username:   user?.username   || '',
    phone:      user?.phone      || '',
    branch:     user?.branch     || '',
    is_staff:   user?.is_staff   ?? false,
    is_superuser: user?.is_superuser ?? false,
    password:   '',
    password_confirm: '',
  })
  const [selectedRoles, setSelectedRoles] = useState<number[]>(user?.roles.map(r => r.id) || [])
  const [saving, setSaving] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const toggleRole = (id: number) =>
    setSelectedRoles(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id])

  const handleSave = async () => {
    if (!form.first_name) { toast.error('Nombre requerido'); return }
    if (!form.email)      { toast.error('Email requerido'); return }
    if (!isEdit && form.password.length < 8) { toast.error('Contraseña mínimo 8 caracteres'); return }
    if (!isEdit && form.password !== form.password_confirm) { toast.error('Las contraseñas no coinciden'); return }

    setSaving(true)
    try {
      let savedUser: UserItem
      if (isEdit) {
        const r = await api.patch(`/auth/users/${user!.id}/update_profile/`, {
          first_name: form.first_name, last_name: form.last_name,
          phone: form.phone, branch: form.branch || null,
          is_staff: form.is_staff, is_superuser: form.is_superuser,
        })
        savedUser = r.data
      } else {
        const r = await api.post('/auth/users/', {
          first_name: form.first_name, last_name: form.last_name,
          email: form.email, username: form.username || form.email.split('@')[0],
          phone: form.phone, branch: form.branch || null,
          password: form.password, password_confirm: form.password_confirm,
        })
        savedUser = r.data
      }
      // Asignar roles
      await api.post(`/auth/users/${savedUser.id}/assign_roles/`, { role_ids: selectedRoles })
      toast.success(isEdit ? 'Usuario actualizado' : 'Usuario creado exitosamente')
      onSaved()
    } catch (e) {
      toast.error(extractApiError(e, 'Error guardando usuario'))
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="font-bold text-gray-900">{isEdit ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Datos personales */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre *</label>
              <input value={form.first_name} onChange={e => set('first_name', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Apellido</label>
              <input value={form.last_name} onChange={e => set('last_name', e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} disabled={isEdit} className={`${inputCls} ${isEdit ? 'bg-gray-50 text-gray-500' : ''}`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Teléfono</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} className={inputCls} placeholder="809-000-0000" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Sucursal</label>
              <select value={form.branch} onChange={e => set('branch', e.target.value)} className={inputCls}>
                <option value="">— Sin asignar —</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>

          {/* Contraseña (solo crear) */}
          {!isEdit && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Contraseña *</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={form.password}
                    onChange={e => set('password', e.target.value)}
                    className={`${inputCls} pr-9`} placeholder="Mín. 8 caracteres" />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Confirmar</label>
                <input type={showPass ? 'text' : 'password'} value={form.password_confirm}
                  onChange={e => set('password_confirm', e.target.value)} className={inputCls} />
              </div>
            </div>
          )}

          {/* Permisos de acceso */}
          <div className="p-3 bg-gray-50 rounded-xl space-y-2">
            <p className="text-xs font-semibold text-gray-600">Nivel de acceso</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_staff}
                onChange={e => set('is_staff', e.target.checked)} className="rounded" />
              <span className="text-sm text-gray-700">Staff (puede gestionar el sistema)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_superuser}
                onChange={e => set('is_superuser', e.target.checked)} className="rounded" />
              <span className="text-sm text-gray-700">Superadministrador (acceso total)</span>
            </label>
          </div>

          {/* Roles */}
          {roles.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Roles asignados</p>
              <div className="flex flex-wrap gap-2">
                {roles.map(r => (
                  <button key={r.id} onClick={() => toggleRole(r.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      selectedRoles.includes(r.id)
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                    }`}>
                    {selectedRoles.includes(r.id) && <CheckCircle className="inline h-3 w-3 mr-1" />}
                    {r.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-60 text-sm">
            {saving ? <><RefreshCw className="h-4 w-4 animate-spin" />Guardando...</> : <><Save className="h-4 w-4" />{isEdit ? 'Guardar cambios' : 'Crear usuario'}</>}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Resetear contraseña ───────────────────────────────────────────────
function ResetPasswordModal({ user, onClose }: { user: UserItem; onClose: () => void }) {
  const [pwd, setPwd] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleReset = async () => {
    if (pwd.length < 8) { toast.error('Mínimo 8 caracteres'); return }
    setSaving(true)
    try {
      const r = await api.post(`/auth/users/${user.id}/reset_password/`, { new_password: pwd })
      toast.success(r.data.detail)
      onClose()
    } catch (e) {
      toast.error(extractApiError(e, 'Error reseteando contraseña'))
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Resetear contraseña</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">Usuario: <strong>{user.full_name || user.email}</strong></p>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nueva contraseña</label>
            <div className="relative">
              <input type={show ? 'text' : 'password'} value={pwd} onChange={e => setPwd(e.target.value)}
                className={`${inputCls} pr-9`} placeholder="Mínimo 8 caracteres" />
              <button onClick={() => setShow(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleReset} disabled={saving}
              className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
              {saving ? 'Reseteando...' : 'Resetear contraseña'}
            </button>
            <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function UsersPage() {
  const { user: currentUser } = useAuthStore()
  const [users, setUsers]     = useState<UserItem[]>([])
  const [roles, setRoles]     = useState<Role[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [showForm, setShowForm]   = useState(false)
  const [editUser, setEditUser]   = useState<UserItem | undefined>()
  const [resetUser, setResetUser] = useState<UserItem | undefined>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {}
      if (search) params.search = search
      const [ur, rr, br] = await Promise.all([
        api.get('/auth/users/', { params }),
        api.get('/auth/roles/'),
        api.get('/branches/'),
      ])
      setUsers(ur.data.results || ur.data)
      setRoles(rr.data.results || rr.data)
      setBranches(br.data.results || br.data)
    } catch {} finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  const handleToggleActive = async (u: UserItem) => {
    if (!confirm(`¿${u.is_active ? 'Desactivar' : 'Activar'} al usuario ${u.full_name || u.email}?`)) return
    try {
      const r = await api.post(`/auth/users/${u.id}/toggle_active/`)
      toast.success(r.data.message)
      load()
    } catch (e) { toast.error(extractApiError(e, 'Error')) }
  }

  const isAdmin = currentUser?.email === 'admin@credcore.local' ||
    (currentUser as unknown as { is_superuser?: boolean })?.is_superuser

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Users className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Gestión de Usuarios</h1>
              <p className="text-xs text-gray-400">{users.length} usuarios registrados</p>
            </div>
          </div>
          {isAdmin && (
            <button onClick={() => { setEditUser(undefined); setShowForm(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
              <Plus className="h-4 w-4" /> Nuevo Usuario
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Buscador */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input placeholder="Buscar por nombre, email, teléfono..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <button onClick={load} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
            <RefreshCw className={`h-4 w-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-20"><RefreshCw className="h-6 w-6 text-primary-500 animate-spin" /></div>
          ) : users.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No hay usuarios</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Usuario', 'Email', 'Teléfono', 'Roles', 'Acceso', 'Estado', 'Registro', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-gray-500 text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map(u => (
                    <tr key={u.id} className={`hover:bg-gray-50 ${!u.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                            <span className="text-primary-700 text-sm font-bold">
                              {(u.full_name || u.email)?.charAt(0)?.toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{u.full_name || '—'}</p>
                            <p className="text-xs text-gray-400">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{u.email}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{u.phone || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.is_superuser && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                              SuperAdmin
                            </span>
                          )}
                          {u.is_staff && !u.is_superuser && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                              Staff
                            </span>
                          )}
                          {u.roles.map(r => (
                            <span key={r.id} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                              {r.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.is_superuser ? 'bg-purple-100 text-purple-700' :
                          u.is_staff ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {u.is_superuser ? 'Administrador' : u.is_staff ? 'Staff' : 'Usuario'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 text-xs font-medium ${u.is_active ? 'text-emerald-600' : 'text-gray-400'}`}>
                          {u.is_active
                            ? <><UserCheck className="h-3.5 w-3.5" />Activo</>
                            : <><UserX className="h-3.5 w-3.5" />Inactivo</>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(u.date_joined)}</td>
                      {/* Acciones */}
                      <td className="px-4 py-3">
                        {isAdmin && (
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => { setEditUser(u); setShowForm(true) }}
                              title="Editar usuario"
                              className="p-1.5 rounded-lg bg-gray-50 hover:bg-indigo-50 text-gray-500 hover:text-indigo-600 border border-gray-200 transition-colors">
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setResetUser(u)}
                              title="Resetear contraseña"
                              className="p-1.5 rounded-lg bg-gray-50 hover:bg-amber-50 text-gray-500 hover:text-amber-600 border border-gray-200 transition-colors">
                              <Key className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => handleToggleActive(u)}
                              title={u.is_active ? 'Desactivar' : 'Activar'}
                              className={`p-1.5 rounded-lg border transition-colors ${
                                u.is_active
                                  ? 'bg-gray-50 hover:bg-red-50 text-gray-500 hover:text-red-600 border-gray-200'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-200'
                              }`}>
                              {u.is_active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info de roles disponibles */}
        {roles.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
              <Shield className="h-3.5 w-3.5" /> Roles disponibles en el sistema
            </p>
            <div className="flex flex-wrap gap-2">
              {roles.map(r => (
                <div key={r.id} className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-xs font-semibold text-gray-700">{r.name}</p>
                  {r.description && <p className="text-[10px] text-gray-400">{r.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <UserFormModal
          user={editUser}
          roles={roles}
          branches={branches}
          onClose={() => { setShowForm(false); setEditUser(undefined) }}
          onSaved={() => { setShowForm(false); setEditUser(undefined); load() }}
        />
      )}
      {resetUser && (
        <ResetPasswordModal user={resetUser} onClose={() => { setResetUser(undefined); load() }} />
      )}
    </div>
  )
}
