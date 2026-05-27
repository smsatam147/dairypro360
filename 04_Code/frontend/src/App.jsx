/**
 * App.jsx — Router + protected routes + toast notifications.
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';

// Pages
import Login           from './pages/Login';
import Dashboard       from './pages/Dashboard';
import MilkCollection  from './pages/MilkCollection';
import CattleHealth    from './pages/CattleHealth';
import Inventory       from './pages/Inventory';
import Sales           from './pages/Sales';
import EmployeeRoster  from './pages/EmployeeRoster';
import FinancialReports from './pages/FinancialReports';

/** Protected route: redirects to /login if not authenticated. */
function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

/** Role-gated route: shows 403 if user role not allowed. */
function RoleRoute({ children, roles }) {
  const { user, hasRole } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!hasRole(...roles)) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-4xl mb-4">🚫</div>
            <h2 className="text-xl font-semibold text-gray-800">Access Denied</h2>
            <p className="text-gray-500 mt-2">
              Your role ({user.role}) does not have access to this page.
            </p>
          </div>
        </div>
      </Layout>
    );
  }
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/milk" element={
        <RoleRoute roles={['super_admin','farm_manager','field_worker']}>
          <MilkCollection />
        </RoleRoute>
      } />
      <Route path="/cattle" element={
        <RoleRoute roles={['super_admin','farm_manager','vet']}>
          <CattleHealth />
        </RoleRoute>
      } />
      <Route path="/inventory" element={
        <RoleRoute roles={['super_admin','farm_manager']}>
          <Inventory />
        </RoleRoute>
      } />
      <Route path="/sales" element={
        <RoleRoute roles={['super_admin','accountant']}>
          <Sales />
        </RoleRoute>
      } />
      <Route path="/employees" element={
        <RoleRoute roles={['super_admin','accountant']}>
          <EmployeeRoster />
        </RoleRoute>
      } />
      <Route path="/reports" element={
        <RoleRoute roles={['super_admin','accountant']}>
          <FinancialReports />
        </RoleRoute>
      } />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { fontSize: '14px' },
            success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
