import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from '@/components/layout/MainLayout'
import LoginPage from '@/pages/auth/LoginPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import CustomersPage from '@/pages/customers/CustomersPage'
import CustomerDetailPage from '@/pages/customers/CustomerDetailPage'
import LoanApplicationsPage from '@/pages/applications/LoanApplicationsPage'
import LoansPage from '@/pages/loans/LoansPage'
import LoanDetailPage from '@/pages/loans/LoanDetailPage'
import PaymentsPage from '@/pages/payments/PaymentsPage'
import CashPage from '@/pages/cash/CashPage'
import GuaranteesPage from '@/pages/guarantees/GuaranteesPage'
import ReportsPage from '@/pages/reports/ReportsPage'
import UsersPage from '@/pages/users/UsersPage'
import ConfigPage from '@/pages/config/ConfigPage'
import LoanCalculatorPage from '@/pages/calculator/LoanCalculatorPage'
import CollectionsPage from '@/pages/collections/CollectionsPage'
import InvestorDashboardPage from '@/pages/investors/InvestorDashboardPage'
import { useAuthStore } from '@/store/slices/authStore'

/** Protege rutas privadas: redirige al login si no hay sesión activa */
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      {/* Ruta pública */}
      <Route path="/login" element={<LoginPage />} />

      {/* Rutas privadas */}
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <MainLayout>
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
                <Route path="/config"             element={<ConfigPage />} />
                {/* Ruta 404 interna */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </MainLayout>
          </PrivateRoute>
        }
      />
    </Routes>
  )
}
