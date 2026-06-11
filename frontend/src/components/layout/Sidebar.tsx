import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, CreditCard, DollarSign, ArrowLeftRight,
  Archive, Shield, BarChart3, Settings,
  ClipboardList, Wallet, Calculator, AlertTriangle,
} from 'lucide-react'
import { clsx } from 'clsx'
import { companyService } from '@/services/company'
import defaultLogo from '@/assets/logo.png'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/customers', icon: Users, label: 'Clientes' },
  { to: '/applications', icon: ClipboardList, label: 'Solicitudes' },
  { to: '/loans', icon: CreditCard, label: 'Préstamos' },
  { to: '/payments', icon: DollarSign, label: 'Cobros' },
  { to: '/collections', icon: AlertTriangle, label: 'Cobranza' },
  { to: '/cash', icon: Wallet, label: 'Caja' },
  { to: '/exchange', icon: ArrowLeftRight, label: 'Cambio USD' },
  { to: '/guarantees', icon: Archive, label: 'Garantías' },
  { to: '/reports', icon: BarChart3, label: 'Reportes' },
  { to: '/calculator', icon: Calculator, label: 'Calculadora' },
  { to: '/users', icon: Shield, label: 'Usuarios' },
  { to: '/config', icon: Settings, label: 'Configuración' },
]

interface Props { open: boolean; onClose: () => void }

export default function Sidebar({ open }: Props) {
  const [companyName, setCompanyName] = useState('CredCore')
  const [logoUrl, setLogoUrl] = useState<string>(defaultLogo)

  useEffect(() => {
    companyService.get().then(r => {
      if (r.data.company_name) setCompanyName(r.data.company_name)
      if (r.data.logo) setLogoUrl(r.data.logo)
    }).catch(() => {})
  }, [])

  return (
    <aside
      className={clsx(
        'bg-gray-900 text-white transition-all duration-300 flex flex-col',
        open ? 'w-64' : 'w-16'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-3 border-b border-gray-700">
        <div className="h-10 w-10 bg-white rounded-lg flex items-center justify-center shrink-0 p-0.5">
          <img src={logoUrl} alt={companyName} className="h-full w-full object-contain" />
        </div>
        {open && <span className="ml-3 font-bold text-lg truncate">{companyName}</span>}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center px-4 py-2.5 text-sm font-medium transition-colors rounded-lg mx-2',
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              )
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            {open && <span className="ml-3">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Version */}
      {open && (
        <div className="p-4 border-t border-gray-700 text-xs text-gray-500">
          CredCore v1.0.0
        </div>
      )}
    </aside>
  )
}
