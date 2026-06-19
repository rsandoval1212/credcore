import TopNav from './TopNav'
import ConnectionStatusBar from '@/components/offline/ConnectionStatusBar'
import UpdateBanner from './UpdateBanner'
import PWAInstallPrompt from '@/components/ui/PWAInstallPrompt'
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts'

interface Props { children: React.ReactNode }

export default function MainLayout({ children }: Props) {
  useGlobalShortcuts()
  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <TopNav />
      <ConnectionStatusBar />
      <UpdateBanner />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <PWAInstallPrompt />
    </div>
  )
}
