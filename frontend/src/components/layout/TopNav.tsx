import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, CreditCard, DollarSign,
  Archive, Shield, BarChart3, Settings, Moon, Sun, Calendar, Route,
  ClipboardList, Wallet, Calculator, AlertTriangle, ArrowLeftRight,
  Bell, LogOut, ChevronDown, Menu, X, Clock,
} from 'lucide-react'

// ─── Botón compacto con fecha+hora desplegable ───────────────────────────────
function ClockButton() {
  const [now, setNow] = useState(new Date())
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const DAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const MONTHS_LONG = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

  const time = now.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', hour12: true })
  const timeSec = now.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  const fullDate = `${DAYS_LONG[now.getDay()]}, ${now.getDate()} de ${MONTHS_LONG[now.getMonth()]} de ${now.getFullYear()}`

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)}
        title={fullDate + ' · ' + timeSec}
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-gray-700 transition-colors">
        <Clock className="h-4 w-4 text-primary-400" />
        <span className="hidden md:inline text-xs font-mono text-white">{time}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 min-w-[240px] bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 z-50 animate-in fade-in zoom-in-95">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 font-mono text-center">{timeSec}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">{fullDate}</p>
          <p className="text-[10px] text-gray-400 text-center mt-2 border-t border-gray-100 dark:border-gray-700 pt-2">Zona horaria: {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
        </div>
      )}
    </div>
  )
}
import { clsx } from 'clsx'
import { companyService } from '@/services/company'
import { notificationsService } from '@/services/notifications'
import { useAuthStore } from '@/store/slices/authStore'
import { useThemeStore } from '@/store/slices/themeStore'
import NotificationsPanel from '@/components/notifications/NotificationsPanel'
import defaultLogo from '@/assets/logo.png'

const navItems = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Inicio'       },
  { to: '/customers',    icon: Users,           label: 'Clientes'     },
  { to: '/applications', icon: ClipboardList,   label: 'Solicitudes'  },
  { to: '/loans',        icon: CreditCard,      label: 'Préstamos'    },
  { to: '/payments',     icon: DollarSign,      label: 'Cobros'       },
  { to: '/route',        icon: Route,           label: 'Mi Ruta'      },
  { to: '/calendar',     icon: Calendar,        label: 'Calendario'   },
  { to: '/collections',  icon: AlertTriangle,   label: 'Cobranza'     },
  { to: '/cash',         icon: Wallet,          label: 'Caja'         },
  { to: '/exchange',     icon: ArrowLeftRight,  label: 'Cambio'       },
  { to: '/guarantees',   icon: Archive,         label: 'Garantías'    },
  { to: '/reports',      icon: BarChart3,       label: 'Reportes'     },
  { to: '/calculator',   icon: Calculator,      label: 'Calculadora'  },
  { to: '/investors',    icon: DollarSign,      label: 'Inversiones'  },
  { to: '/users',        icon: Shield,          label: 'Usuarios'     },
  { to: '/config',       icon: Settings,        label: 'Config'       },
]

export default function TopNav() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { theme, toggle: toggleTheme } = useThemeStore()
  const [companyName, setCompanyName] = useState('CredCore')
  const [logoUrl, setLogoUrl]         = useState<string>(defaultLogo)
  const [alertCount, setAlertCount]   = useState(0)
  const [showPanel, setShowPanel]     = useState(false)
  const [showUser, setShowUser]       = useState(false)
  const [mobileOpen, setMobileOpen]   = useState(false)
  const userRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    companyService.get().then(r => {
      if (r.data.company_name) setCompanyName(r.data.company_name)
      if (r.data.logo) setLogoUrl(r.data.logo)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const fetch = async () => {
      try {
        const r = await notificationsService.getAlertsSummary(7)
        setAlertCount(r.data.total)
      } catch {}
    }
    fetch()
    const id = setInterval(fetch, 120_000)
    return () => clearInterval(id)
  }, [])

  // Cerrar dropdown al click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setShowUser(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all whitespace-nowrap min-w-0',
      isActive
        ? 'bg-primary-600 text-white shadow-md'
        : 'text-gray-400 hover:bg-gray-700 hover:text-white'
    )

  return (
    <>
      {/* ── Barra principal oscura ─────────────────────────────────────────── */}
      <header className="bg-gray-900 shrink-0 z-30 shadow-lg">
        <div className="flex items-center h-14 px-3 gap-2">

          {/* ── Logo ───────────────────────────────────────────────────── */}
          <div className="flex items-center gap-2 shrink-0 pr-2 border-r border-gray-700">
            <div className="h-7 w-7 bg-white rounded-lg flex items-center justify-center p-0.5 shrink-0">
              <img src={logoUrl} alt={companyName} className="h-full w-full object-contain" />
            </div>
            <span className="font-bold text-white text-xs sm:text-sm hidden sm:block truncate max-w-[120px] xl:max-w-[160px]">
              {companyName}
            </span>
          </div>

          {/* Reloj compacto en mobile/tablet */}
          <div className="flex lg:hidden">
                      </div>

          {/* ── Navegación horizontal (desktop) ──────────────────────── */}
          <nav className="hidden lg:flex items-center gap-0.5 flex-1 overflow-x-auto scrollbar-hide px-0.5">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} className={navLinkClass}>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="leading-none truncate max-w-[72px]">{label}</span>
              </NavLink>
            ))}

            {/* Reloj — justificado a la derecha después de Configuración */}
            <div className="ml-auto" />
                      </nav>

          {/* Spacer en tablet */}
          <div className="flex-1 lg:hidden" />

          {/* ── Acciones derecha ─────────────────────────────────────── */}
          <div className="flex items-center gap-0.5 shrink-0">

            {/* Reloj compacto */}
            <ClockButton />

            {/* Tema */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {theme === 'dark'
                ? <Sun className="h-4 w-4 text-amber-300" />
                : <Moon className="h-4 w-4 text-gray-300" />}
            </button>

            {/* Notificaciones */}
            <button
              onClick={() => setShowPanel(true)}
              className="relative p-2 rounded-lg hover:bg-gray-700 transition-colors"
              title="Alertas de cobro"
            >
              <Bell className="h-4 w-4 text-gray-300" />
              {alertCount > 0 && (
                <span className="absolute top-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold ring-2 ring-gray-900">
                  {alertCount > 99 ? '99+' : alertCount}
                </span>
              )}
            </button>

            {/* Usuario */}
            <div ref={userRef} className="relative">
              <button
                onClick={() => setShowUser(v => !v)}
                className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-lg hover:bg-gray-700 transition-colors border border-transparent hover:border-gray-600"
              >
                <div className="w-7 h-7 bg-primary-600 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-white text-xs font-bold uppercase">
                    {(user?.first_name?.[0] || user?.email?.[0] || 'A')}
                  </span>
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-white leading-tight truncate max-w-[180px]">
                    {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.email}
                  </p>
                  <p className="text-[10px] text-gray-400 leading-tight">
                    {user?.roles?.some(r => r.name === 'admin' || r.name === 'Admin') ? 'Administrador' : 'Usuario'}
                  </p>
                </div>
                <ChevronDown className={clsx('h-3.5 w-3.5 text-gray-400 transition-transform hidden sm:block', showUser && 'rotate-180')} />
              </button>

              {showUser && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl border border-gray-200 shadow-xl py-1 z-50">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.email}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>

            {/* Hamburguesa (mobile/tablet) */}
            <button
              onClick={() => setMobileOpen(v => !v)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              {mobileOpen
                ? <X className="h-5 w-5 text-gray-300" />
                : <Menu className="h-5 w-5 text-gray-300" />}
            </button>
          </div>
        </div>

        {/* ── Menú mobile desplegable ───────────────────────────────────── */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-gray-700 bg-gray-800 px-3 sm:px-4 py-3 max-h-[70vh] overflow-y-auto">
            <nav className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5 sm:gap-2">
              {navItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    clsx(
                      'flex flex-col items-center gap-1 p-2.5 rounded-xl text-[11px] sm:text-xs font-medium transition-all',
                      isActive
                        ? 'bg-primary-600 text-white shadow-md'
                        : 'text-gray-300 hover:bg-gray-700 active:bg-gray-600'
                    )
                  }
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-center leading-tight">{label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </header>

      {showPanel && <NotificationsPanel onClose={() => setShowPanel(false)} />}
    </>
  )
}
