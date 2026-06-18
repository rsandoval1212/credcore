import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Users, Search, RefreshCw, Shield, UserCheck, UserX,
  Plus, Edit3, Key, X, Save, Eye, EyeOff, CheckCircle,
  Filter, ChevronLeft, ChevronRight, ShieldCheck, Phone, Mail,
  Crown, MoreVertical, Clock, Building2,
} from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { extractApiError } from '@/utils/apiError'
import { useAuthStore } from '@/store/slices/authStore'

interface UserItem {
  id: string; full_name: string; first_name: string; last_name: string
  email: string; username: string; phone: string
  is_active: boolean; is_staff: boolean; is_superuser: boolean
  two_factor_enabled?: boolean
  roles: { id: number; name: string }[]
  branch: number | null; branch_name?: string
  date_joined: string; last_login?: string | null
  failed_login_attempts?: number
}
interface Role { id: number; name: string; description: string }
interface Branch { id: number; name: string }

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
const fmtDate = (d?: string | null) => !d ? '—' : new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtDateTime = (d?: string | null) => !d ? 'Nunca' : new Date(d).toLocaleString('es-DO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function timeAgo(d?: string | null): string {
  if (!d) return 'Nunca'
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `Hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Hace ${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `Hace ${days}d`
  return fmtDate(d)
}

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
      if (isEdit) {
        await api.patch(`/auth/users/${user!.id}/update_profile/`, {
          first_name: form.first_name, last_name: form.last_name,
          phone: form.phone, branch: form.branch || null,
          is_staff: form.is_staff, is_superuser: form.is_superuser,
        })
        await api.post(`/auth/users/${user!.id}/assign_roles/`, { role_ids: selectedRoles })
      } else {
        const r = await api.post('/auth/users/', {
          first_name: form.first_name, last_name: form.last_name,
          email: form.email, username: form.username || form.email.split('@')[0],
          phone: form.phone, branch: form.branch || null,
          password: form.password, password_confirm: form.password_confirm,
          role_ids: selectedRoles,
          is_staff: form.is_staff, is_superuser: form.is_superuser,
        })
        if (selectedRoles.length > 0 && r.data?.id) {
          await api.post(`/auth/users/${r.data.id}/assign_roles/`, { role_ids: selectedRoles })
        }
      }
      toast.success(isEdit ? 'Usuario actualizado' : 'Usuario creado exitosamente')
      onSaved()
    } catch (e) {
      toast.error(extractApiError(e, 'Error guardando usuario'))
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg shadow-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="font-bold text-gray-900 text-base sm:text-lg">{isEdit ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5 text-gray-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Datos personales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-60 text-sm">
            {saving ? <><RefreshCw className="h-4 w-4 animate-spin" />Guardando...</> : <><Save className="h-4 w-4" />{isEdit ? 'Guardar cambios' : 'Crear usuario'}</>}
          </button>
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Resetear contraseña</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        <div className="p-4 sm:p-6 space-y-4">
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
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
            <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50">Cancelar</button>
            <button onClick={handleReset} disabled={saving}
              className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
              {saving ? 'Reseteando...' : 'Resetear contraseña'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Card de usuario (mobile) ────────────────────────────────────────────────
function UserCard({ u, isAdmin, onEdit, onReset, onToggle }: {
  u: UserItem; isAdmin: boolean
  onEdit: (u: UserItem) => void
  onReset: (u: UserItem) => void
  onToggle: (u: UserItem) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 ${!u.is_active ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
          <span className="text-primary-700 text-base font-bold">
            {(u.full_name || u.email)?.charAt(0)?.toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900 truncate">{u.full_name || u.email}</p>
              <p className="text-xs text-gray-400 truncate">@{u.username}</p>
            </div>
            {isAdmin && (
              <div className="relative shrink-0">
                <button onClick={() => setMenuOpen(v => !v)} className="p-1.5 rounded-lg hover:bg-gray-100">
                  <MoreVertical className="h-4 w-4 text-gray-500" />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                      <button onClick={() => { setMenuOpen(false); onEdit(u) }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        <Edit3 className="h-4 w-4" /> Editar
                      </button>
                      <button onClick={() => { setMenuOpen(false); onReset(u) }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        <Key className="h-4 w-4" /> Resetear contraseña
                      </button>
                      <button onClick={() => { setMenuOpen(false); onToggle(u) }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${u.is_active ? 'text-red-600' : 'text-emerald-600'}`}>
                        {u.is_active ? <><UserX className="h-4 w-4" /> Desactivar</> : <><UserCheck className="h-4 w-4" /> Activar</>}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Email + teléfono */}
          <div className="mt-2 space-y-1 text-xs text-gray-500">
            <p className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3 shrink-0" /> {u.email}</p>
            {u.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {u.phone}</p>}
            {u.branch_name && <p className="flex items-center gap-1.5"><Building2 className="h-3 w-3" /> {u.branch_name}</p>}
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {u.is_superuser && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                <Crown className="h-3 w-3" /> SuperAdmin
              </span>
            )}
            {u.is_staff && !u.is_superuser && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">Staff</span>
            )}
            {u.two_factor_enabled && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                <ShieldCheck className="h-3 w-3" /> 2FA
              </span>
            )}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
              {u.is_active ? <UserCheck className="h-3 w-3" /> : <UserX className="h-3 w-3" />}
              {u.is_active ? 'Activo' : 'Inactivo'}
            </span>
            {u.roles.slice(0, 3).map(r => (
              <span key={r.id} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                {r.name}
              </span>
            ))}
            {u.roles.length > 3 && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">+{u.roles.length - 3}</span>
            )}
          </div>

          {/* Último login */}
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {timeAgo(u.last_login)}</span>
            <span>Reg. {fmtDate(u.date_joined)}</span>
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
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('')
  const [accessFilter, setAccessFilter] = useState<'' | 'superuser' | 'staff' | 'standard'>('')
  const [branchFilter, setBranchFilter] = useState('')
  const [page, setPage]       = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [showForm, setShowForm]   = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [editUser, setEditUser]   = useState<UserItem | undefined>()
  const [resetUser, setResetUser] = useState<UserItem | undefined>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page }
      if (search) params.search = search
      if (statusFilter === 'active') params.is_active = true
      if (statusFilter === 'inactive') params.is_active = false
      if (accessFilter === 'superuser') params.is_superuser = true
      if (accessFilter === 'staff') { params.is_staff = true; params.is_superuser = false }
      if (accessFilter === 'standard') { params.is_staff = false; params.is_superuser = false }
      if (branchFilter) params.branch = branchFilter

      const [ur, rr, br] = await Promise.all([
        api.get('/auth/users/', { params }),
        roles.length === 0 ? api.get('/auth/roles/') : Promise.resolve({ data: { results: roles } }),
        branches.length === 0 ? api.get('/branches/') : Promise.resolve({ data: { results: branches } }),
      ])
      setUsers(ur.data.results || ur.data)
      setTotalPages(ur.data.total_pages || 1)
      setTotalCount(ur.data.count ?? (ur.data.results || ur.data).length)
      if (rr.data.results || Array.isArray(rr.data)) setRoles(rr.data.results || rr.data)
      if (br.data.results || Array.isArray(br.data)) setBranches(br.data.results || br.data)
    } catch (e) {
      toast.error(extractApiError(e, 'Error cargando usuarios'))
    } finally { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statusFilter, accessFilter, branchFilter])

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

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.is_active).length,
    admins: users.filter(u => u.is_superuser).length,
    twoFA: users.filter(u => u.two_factor_enabled).length,
  }), [users])

  const activeFiltersCount = [statusFilter, accessFilter, branchFilter, search].filter(Boolean).length

  const clearFilters = () => {
    setStatusFilter(''); setAccessFilter(''); setBranchFilter(''); setSearch(''); setPage(1)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-gray-900">Gestión de Usuarios</h1>
              <p className="text-xs text-gray-400">{totalCount} usuarios registrados</p>
            </div>
          </div>
          {isAdmin && (
            <button onClick={() => { setEditUser(undefined); setShowForm(true) }}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium shrink-0">
              <Plus className="h-4 w-4" /> Nuevo Usuario
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {/* Stats compactos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <StatChip label="Total" value={totalCount} color="bg-gray-100 text-gray-700" icon={<Users className="h-4 w-4" />} />
          <StatChip label="Activos" value={stats.active} color="bg-emerald-100 text-emerald-700" icon={<UserCheck className="h-4 w-4" />} />
          <StatChip label="Admins" value={stats.admins} color="bg-purple-100 text-purple-700" icon={<Crown className="h-4 w-4" />} />
          <StatChip label="Con 2FA" value={stats.twoFA} color="bg-blue-100 text-blue-700" icon={<ShieldCheck className="h-4 w-4" />} />
        </div>

        {/* Buscador + filtros */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input placeholder="Buscar nombre, email, teléfono..." value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <button onClick={() => setShowFilters(v => !v)}
              className={`relative px-3 py-2 border rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeFiltersCount > 0
                  ? 'border-primary-300 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filtros</span>
              {activeFiltersCount > 0 && (
                <span className="bg-primary-600 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>
            <button onClick={load} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 shrink-0">
              <RefreshCw className={`h-4 w-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3 border-t border-gray-100">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Estado</label>
                <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1) }} className={inputCls}>
                  <option value="">Todos</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Nivel de acceso</label>
                <select value={accessFilter} onChange={e => { setAccessFilter(e.target.value as typeof accessFilter); setPage(1) }} className={inputCls}>
                  <option value="">Todos</option>
                  <option value="superuser">Superadmin</option>
                  <option value="staff">Staff</option>
                  <option value="standard">Usuario estándar</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Sucursal</label>
                <select value={branchFilter} onChange={e => { setBranchFilter(e.target.value); setPage(1) }} className={inputCls}>
                  <option value="">Todas</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              {activeFiltersCount > 0 && (
                <div className="sm:col-span-3 flex justify-end">
                  <button onClick={clearFilters}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                    <X className="h-3 w-3" /> Limpiar filtros
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Loading / vacío */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-200 flex justify-center py-20">
            <RefreshCw className="h-6 w-6 text-primary-500 animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 text-center py-20 text-gray-400">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No se encontraron usuarios</p>
            {activeFiltersCount > 0 && (
              <button onClick={clearFilters} className="mt-3 text-primary-600 text-sm hover:underline">
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Vista cards (mobile) */}
            <div className="md:hidden space-y-3">
              {users.map(u => (
                <UserCard
                  key={u.id}
                  u={u}
                  isAdmin={!!isAdmin}
                  onEdit={u => { setEditUser(u); setShowForm(true) }}
                  onReset={u => setResetUser(u)}
                  onToggle={handleToggleActive}
                />
              ))}
            </div>

            {/* Vista tabla (desktop / tablet) */}
            <div className="hidden md:block bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Usuario', 'Contacto', 'Roles', 'Acceso', 'Estado', 'Último login', ''].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-semibold text-gray-500 text-xs whitespace-nowrap">{h}</th>
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
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 truncate">{u.full_name || '—'}</p>
                              <p className="text-xs text-gray-400 truncate">@{u.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-gray-600 truncate max-w-[200px]">{u.email}</p>
                          {u.phone && <p className="text-xs text-gray-400">{u.phone}</p>}
                          {u.branch_name && <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5"><Building2 className="h-2.5 w-2.5" />{u.branch_name}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {u.roles.length === 0 && <span className="text-xs text-gray-300">Sin roles</span>}
                            {u.roles.map(r => (
                              <span key={r.id} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                                {r.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              u.is_superuser ? 'bg-purple-100 text-purple-700' :
                              u.is_staff ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {u.is_superuser ? 'SuperAdmin' : u.is_staff ? 'Staff' : 'Usuario'}
                            </span>
                            {u.two_factor_enabled && (
                              <span title="2FA activado" className="text-emerald-600">
                                <ShieldCheck className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`flex items-center gap-1 text-xs font-medium ${u.is_active ? 'text-emerald-600' : 'text-gray-400'}`}>
                            {u.is_active
                              ? <><UserCheck className="h-3.5 w-3.5" />Activo</>
                              : <><UserX className="h-3.5 w-3.5" />Inactivo</>}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-gray-600">{timeAgo(u.last_login)}</p>
                          <p className="text-[10px] text-gray-400">{fmtDateTime(u.last_login)}</p>
                        </td>
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
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3">
                <p className="text-xs sm:text-sm text-gray-500">Página {page} de {totalPages} · {totalCount} usuarios</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

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

function StatChip({ label, value, color, icon }: {
  label: string; value: number; color: string; icon: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-2 sm:gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-lg sm:text-xl font-black text-gray-900 leading-tight">{value}</p>
        <p className="text-xs text-gray-500 leading-tight">{label}</p>
      </div>
    </div>
  )
}
