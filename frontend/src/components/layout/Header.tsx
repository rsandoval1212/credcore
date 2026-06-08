import { useState, useEffect } from 'react'
import { Menu, Bell, User } from 'lucide-react'
import { notificationsService } from '@/services/notifications'
import { companyService } from '@/services/company'
import NotificationsPanel from '@/components/notifications/NotificationsPanel'

interface Props { onMenuClick: () => void }

export default function Header({ onMenuClick }: Props) {
  const [alertCount, setAlertCount] = useState(0)
  const [showPanel, setShowPanel] = useState(false)
  const [companyName, setCompanyName] = useState('CredCore')

  useEffect(() => {
    companyService.get().then(r => {
      if (r.data.company_name) setCompanyName(r.data.company_name)
    }).catch(() => {})
  }, [])

  // Cargar conteo de alertas cada 2 minutos
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const r = await notificationsService.getAlertsSummary(7)
        setAlertCount(r.data.total)
      } catch {}
    }
    fetchCount()
    const interval = setInterval(fetchCount, 120_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <>
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
        <button onClick={onMenuClick} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <Menu className="h-5 w-5 text-gray-600" />
        </button>

        <div className="flex items-center gap-3">
          {/* Campana de notificaciones */}
          <button
            onClick={() => setShowPanel(true)}
            className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Alertas de cobro"
          >
            <Bell className="h-5 w-5 text-gray-600" />
            {alertCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none ring-2 ring-white">
                {alertCount > 99 ? '99+' : alertCount}
              </span>
            )}
          </button>

          {/* Usuario */}
          <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-primary-600" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-gray-900 truncate max-w-[160px]">{companyName}</p>
              <p className="text-xs text-gray-500">Administrador</p>
            </div>
          </div>
        </div>
      </header>

      {/* Panel de notificaciones (slide-in) */}
      {showPanel && <NotificationsPanel onClose={() => setShowPanel(false)} />}
    </>
  )
}
