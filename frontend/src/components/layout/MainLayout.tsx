import TopNav from './TopNav'
import ConnectionStatusBar from '@/components/offline/ConnectionStatusBar'
import PWAInstallPrompt from '@/components/ui/PWAInstallPrompt'

interface Props { children: React.ReactNode }

export default function MainLayout({ children }: Props) {
  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      <TopNav />
      <ConnectionStatusBar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <PWAInstallPrompt />
    </div>
  )
}
