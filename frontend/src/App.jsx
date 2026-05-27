import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MilkCollection from './pages/MilkCollection';
import Sidebar from './components/Sidebar';

// Protected route wrapper
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('dp360_token');
  if (!token) return <Navigate to="/login" replace />;
  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div style={{ marginLeft: 240, flex: 1, minHeight: '100vh' }}>
        {children}
      </div>
    </div>
  );
};

// Placeholder pages for future modules
const PlaceholderPage = ({ title, icon }) => (
  <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
    <div style={{ fontSize: 64, marginBottom: '1rem' }}>{icon}</div>
    <h2 style={{ color: '#1a3c5e' }}>{title}</h2>
    <p>This module is being developed. See the FRD and Project Plan for implementation details.</p>
    <div style={{ background: '#eaf2fb', padding: '1rem', borderRadius: 8, display: 'inline-block', marginTop: '1rem' }}>
      <strong>Sprint Progress:</strong> Module scaffolded · API routes ready · UI in development
    </div>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route path="/dashboard" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />
        <Route path="/collection" element={
          <ProtectedRoute><MilkCollection /></ProtectedRoute>
        } />
        <Route path="/cattle" element={
          <ProtectedRoute><PlaceholderPage title="Farm & Cattle Management" icon="🐄" /></ProtectedRoute>
        } />
        <Route path="/production" element={
          <ProtectedRoute><PlaceholderPage title="Processing & Production" icon="🏭" /></ProtectedRoute>
        } />
        <Route path="/inventory" element={
          <ProtectedRoute><PlaceholderPage title="Inventory Management" icon="📦" /></ProtectedRoute>
        } />
        <Route path="/delivery" element={
          <ProtectedRoute><PlaceholderPage title="Distribution & Delivery" icon="🚚" /></ProtectedRoute>
        } />
        <Route path="/invoices" element={
          <ProtectedRoute><PlaceholderPage title="Billing & Finance" icon="📄" /></ProtectedRoute>
        } />
        <Route path="/hr" element={
          <ProtectedRoute><PlaceholderPage title="HR & Payroll" icon="👥" /></ProtectedRoute>
        } />
        <Route path="/reports" element={
          <ProtectedRoute><PlaceholderPage title="Reports & Analytics" icon="📈" /></ProtectedRoute>
        } />
        <Route path="/users" element={
          <ProtectedRoute><PlaceholderPage title="User Management" icon="🔐" /></ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
