/**
 * components/Sidebar.jsx — Role-based navigation sidebar.
 */
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { path: '/',           label: 'Dashboard',         icon: '📊', roles: ['super_admin','farm_manager','accountant','field_worker','vet','viewer'] },
  { path: '/milk',       label: 'Milk Entry',        icon: '🥛', roles: ['super_admin','farm_manager','field_worker'] },
  { path: '/cattle',     label: 'Cattle Health',     icon: '🐄', roles: ['super_admin','farm_manager','vet'] },
  { path: '/inventory',  label: 'Inventory',         icon: '📦', roles: ['super_admin','farm_manager'] },
  { path: '/sales',      label: 'Sales',             icon: '💰', roles: ['super_admin','accountant'] },
  { path: '/employees',  label: 'Employee Roster',   icon: '👥', roles: ['super_admin','accountant'] },
  { path: '/reports',    label: 'Financial Reports', icon: '📈', roles: ['super_admin','accountant'] },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  const visibleItems = NAV_ITEMS.filter(
    item => user && item.roles.includes(user.role)
  );

  return (
    <aside className="flex flex-col h-screen w-64 bg-primary-900 text-white shadow-xl fixed left-0 top-0 z-10">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-primary-700">
        <div className="text-2xl font-bold tracking-tight">🥛 DairyPro 360</div>
        <div className="text-xs text-primary-100 mt-1">Dairy Management System</div>
      </div>

      {/* User badge */}
      <div className="px-4 py-3 bg-primary-800 mx-3 mt-3 rounded-lg">
        <div className="text-sm font-medium truncate">{user?.full_name}</div>
        <div className="text-xs text-primary-300 capitalize mt-0.5">
          {user?.role?.replace('_', ' ')}
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 mt-4 space-y-1 overflow-y-auto">
        {visibleItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
               ${isActive
                 ? 'bg-primary-600 text-white'
                 : 'text-primary-100 hover:bg-primary-700 hover:text-white'}`
            }
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-primary-700">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                     text-primary-200 hover:bg-red-600 hover:text-white transition-colors"
        >
          <span>🚪</span> Sign Out
        </button>
      </div>
    </aside>
  );
}
