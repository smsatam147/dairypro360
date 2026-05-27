import { useNavigate, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/dashboard', icon: '📊', label: 'Dashboard', roles: ['*'] },
  { path: '/cattle', icon: '🐄', label: 'Farm & Cattle', roles: ['admin','farm_manager','collection_agent'] },
  { path: '/collection', icon: '🥛', label: 'Milk Collection', roles: ['admin','farm_manager','collection_agent'] },
  { path: '/production', icon: '🏭', label: 'Production', roles: ['admin','farm_manager','quality_analyst'] },
  { path: '/inventory', icon: '📦', label: 'Inventory', roles: ['admin','farm_manager','finance'] },
  { path: '/delivery', icon: '🚚', label: 'Delivery', roles: ['admin','distribution_manager','driver'] },
  { path: '/invoices', icon: '📄', label: 'Billing & Finance', roles: ['admin','finance'] },
  { path: '/hr', icon: '👥', label: 'HR & Payroll', roles: ['admin','hr'] },
  { path: '/reports', icon: '📈', label: 'Reports & Analytics', roles: ['admin','finance','farm_manager'] },
  { path: '/users', icon: '🔐', label: 'User Management', roles: ['admin'] },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('dp360_user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('dp360_token');
    localStorage.removeItem('dp360_user');
    navigate('/login');
  };

  const accessible = navItems.filter(item =>
    item.roles.includes('*') || item.roles.includes(user.role)
  );

  return (
    <div style={{
      width: 240, minHeight: '100vh', background: '#1a3c5e',
      display: 'flex', flexDirection: 'column', position: 'fixed', left: 0, top: 0
    }}>
      {/* Logo */}
      <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontSize: 28, textAlign: 'center' }}>🥛</div>
        <div style={{ color: 'white', fontWeight: 700, fontSize: '1.1rem', textAlign: 'center' }}>
          DairyPro 360
        </div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', textAlign: 'center' }}>
          v1.0
        </div>
      </div>

      {/* User Info */}
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{
          background: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: '0.75rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem'
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', background: '#2e7d32',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 700, fontSize: '1rem'
          }}>
            {user.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <div style={{ color: 'white', fontSize: '0.85rem', fontWeight: 600 }}>
              {user.name || 'User'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>
              {user.role?.replace('_',' ')}
            </div>
          </div>
        </div>
      </div>

      {/* Nav Items */}
      <nav style={{ flex: 1, padding: '0.75rem 0', overflowY: 'auto' }}>
        {accessible.map(item => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                width: '100%', padding: '0.7rem 1.25rem',
                background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                border: 'none', borderLeft: isActive ? '3px solid #4fc3f7' : '3px solid transparent',
                color: isActive ? 'white' : 'rgba(255,255,255,0.7)',
                cursor: 'pointer', fontSize: '0.9rem', textAlign: 'left',
                fontWeight: isActive ? 700 : 400, transition: 'all 0.15s'
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <button onClick={handleLogout} style={{
          width: '100%', padding: '0.6rem', background: 'rgba(231,76,60,0.2)',
          color: '#e74c3c', border: '1px solid rgba(231,76,60,0.3)',
          borderRadius: 8, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600
        }}>
          🚪 Sign Out
        </button>
      </div>
    </div>
  );
}
