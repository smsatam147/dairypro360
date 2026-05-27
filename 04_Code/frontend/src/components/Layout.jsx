/**
 * components/Layout.jsx — Main layout wrapper with sidebar.
 */
import Sidebar from './Sidebar';

export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
