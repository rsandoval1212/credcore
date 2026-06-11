import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from '@/components/layout/MainLayout'
import ErrorBoundary from '@/components/ErrorBoundary'
import { useAuthStore } from '@/store/slices/authStore'
import { RefreshCw } from 'lucide-react'

/* ── Lazy-loaded pages (code splitting) ──────────────────────────────────── */
const LoginPage             = lazy(() => import('@/pages/auth/LoginPage'))
const DashboardPage         = lazy(() => import('@/pages/dashboard/DashboardPage'))
const CustomersPage         = lazy(() => import('@/pages/customers/CustomersPage'))
const CustomerDetailPage    = lazy(() => import('@/pages/customers/CustomerDetailPage'))
const LoanApplicationsPage  = lazy(() => import('@/pages/applications/LoanApplicationsPage'))
const LoansPage             = lazy(() => import('@/pages/loans/LoansPage'))
const LoanDetailPage        = lazy(() => import('@/pages/loans/LoanDetailPage'))
const PaymentsPage          = lazy(() => import('@/pages/payments/PaymentsPage'))
const CashPage              = lazy(() => import('@/pages/cash/CashPage'))
const GuaranteesPage        = lazy(() => import('@/pages/guarantees/GuaranteesPage'))
const ReportsPage           = lazy(() => import('@/pages/reports/ReportsPage'))
const UsersPage             = lazy(() => import('@/pages/users/UsersPage'))
const ConfigPage            = lazy(() => import('@/pages/config/ConfigPage'))
const LoanCalculatorPage    = lazy(() => import('@/pages/calculator/LoanCalculatorPage'))
const CollectionsPage       = lazy(() => import('@/pages/collections/CollectionsPage'))
const InvestorDashboardPage = lazy(() => import('@/pages/investors/InvestorDashboardPage'))
const CurrencyExchangePage  = lazy(() => import('@/pages/exchange/CurrencyExchangePage'))

/* ── Loading spinner ─────────────────────────────────────────────────────── */
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="h-6 w-6 text-primary-500 animate-spin" />
    </div>
  )
}

/** Protege rutas privadas: redirige al login si no hay sesión activa */
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Ruta pública */}
          <Route path="/login" element={<LoginPage />} />

          {/* Rutas privadas */}
          <Route
            path="/*"
            element={
              <PrivateRoute>
                <MainLayout>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/dashboard"          element={<DashboardPage />} />
                      <Route path="/customers"          element={<CustomersPage />} />
                      <Route path="/customers/:id"      element={<CustomerDetailPage />} />
                      <Route path="/applications"       element={<LoanApplicationsPage />} />
                      <Route path="/loans"              element={<LoansPage />} />
                      <Route path="/loans/:id"          element={<LoanDetailPage />} />
                      <Route path="/payments"           element={<PaymentsPage />} />
                      <Route path="/collections"        element={<CollectionsPage />} />
                      <Route path="/cash"               element={<CashPage />} />
                      <Route path="/guarantees"         element={<GuaranteesPage />} />
                      <Route path="/reports"            element={<ReportsPage />} />
                      <Route path="/calculator"         element={<LoanCalculatorPage />} />
                      <Route path="/users"              element={<UsersPage />} />
                      <Route path="/investors"          element={<InvestorDashboardPage />} />
                      <Route path="/exchange"           element={<CurrencyExchangePage />} />
                      <Route path="/config"             element={<ConfigPage />} />
                      {/* Ruta 404 interna */}
                      <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                  </Suspense>
                </MainLayout>
              </PrivateRoute>
            }
          />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
