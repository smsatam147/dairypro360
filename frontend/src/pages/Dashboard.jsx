import { useEffect, useState } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Title, Tooltip, Legend, ArcElement
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { getDashboard, getCollectionTrend } from '../api/endpoints';
import toast from 'react-hot-toast';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, ArcElement);

const KPICard = ({ icon, label, value, unit, color, alert }) => (
  <div style={{
    background: 'white', borderRadius: 12, padding: '1.5rem',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    borderLeft: `4px solid ${color}`,
    display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative'
  }}>
    <div style={{ fontSize: 36 }}>{icon}</div>
    <div>
      <div style={{ color: '#666', fontSize: '0.85rem', fontWeight: 500 }}>{label}</div>
      <div style={{ color: '#1a1a1a', fontSize: '1.6rem', fontWeight: 700 }}>
        {value} <span style={{ fontSize: '0.9rem', color: color, fontWeight: 600 }}>{unit}</span>
      </div>
    </div>
    {alert > 0 && (
      <div style={{
        position: 'absolute', top: 8, right: 8,
        background: '#e74c3c', color: 'white', borderRadius: '50%',
        width: 22, height: 22, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700
      }}>{alert}</div>
    )}
  </div>
);

export default function Dashboard() {
  const [kpis, setKpis] = useState(null);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const user = JSON.parse(localStorage.getItem('dp360_user') || '{}');

  useEffect(() => {
    const load = async () => {
      try {
        const [kpiRes, trendRes] = await Promise.all([
          getDashboard(),
          getCollectionTrend({ days: 14 })
        ]);
        setKpis(kpiRes.data);
        setTrend(trendRes.data);
      } catch {
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 30000); // 30s refresh
    return () => clearInterval(interval);
  }, []);

  const trendChart = {
    labels: trend.map(d => new Date(d.collection_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short' })),
    datasets: [{
      label: 'Milk Collected (L)',
      data: trend.map(d => parseFloat(d.total_l || 0)),
      borderColor: '#1a3c5e',
      backgroundColor: 'rgba(26, 60, 94, 0.1)',
      fill: true,
      tension: 0.4,
    }]
  };

  return (
    <div style={{ padding: '2rem', background: '#f5f7fa', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, color: '#1a3c5e', fontSize: '1.6rem' }}>
            🥛 DairyPro 360 — Executive Dashboard
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.9rem' }}>
            Welcome back, <strong>{user.name}</strong> · {new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })}
          </p>
        </div>
        <div style={{
          background: '#1a3c5e', color: 'white', padding: '0.4rem 1rem',
          borderRadius: 20, fontSize: '0.8rem', fontWeight: 600
        }}>
          Role: {user.role?.replace('_', ' ').toUpperCase()}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
          Loading dashboard data...
        </div>
      ) : (
        <>
          {/* KPI Grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem', marginBottom: '1.5rem'
          }}>
            <KPICard icon="🥛" label="Milk Collected Today" value={(kpis?.milk_collected_today_L || 0).toFixed(0)} unit="Litres" color="#1a3c5e" />
            <KPICard icon="💰" label="Revenue This Month" value={`₹${((kpis?.revenue_this_month_INR || 0)/100000).toFixed(2)}L`} unit="" color="#27ae60" />
            <KPICard icon="🐄" label="Healthy Cattle" value={kpis?.active_healthy_cattle || 0} unit="animals" color="#2e7d32" />
            <KPICard icon="🚚" label="Deliveries Today" value={kpis?.deliveries_today || 0} unit="scheduled" color="#e67e22" />
            <KPICard icon="📦" label="Inventory Alerts" value={kpis?.inventory_reorder_alerts || 0} unit="items" color="#e74c3c" alert={kpis?.inventory_reorder_alerts || 0} />
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'white', borderRadius: 12, padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
              <h3 style={{ margin: '0 0 1rem', color: '#1a3c5e', fontSize: '1rem' }}>
                📈 Milk Collection Trend (Last 14 Days)
              </h3>
              <Line data={trendChart} options={{
                responsive: true, plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
              }} />
            </div>
            <div style={{ background: 'white', borderRadius: 12, padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
              <h3 style={{ margin: '0 0 1rem', color: '#1a3c5e', fontSize: '1rem' }}>
                🔔 Quick Actions
              </h3>
              {[
                { label: 'Record Collection', icon: '🥛', path: '/collection/new' },
                { label: 'New Production Batch', icon: '🏭', path: '/production/new' },
                { label: 'View Inventory', icon: '📦', path: '/inventory' },
                { label: 'Delivery Schedule', icon: '🚚', path: '/delivery' },
                { label: 'Generate Invoice', icon: '📄', path: '/invoices/new' },
                { label: 'Reports', icon: '📊', path: '/reports' },
              ].map((a) => (
                <button key={a.label}
                  onClick={() => toast.success(`Navigating to ${a.label}...`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    width: '100%', padding: '0.6rem 0.75rem', marginBottom: '0.4rem',
                    background: '#f5f7fa', border: '1px solid #e0e0e0',
                    borderRadius: 8, cursor: 'pointer', fontSize: '0.9rem',
                    color: '#1a3c5e', fontWeight: 500, textAlign: 'left'
                  }}>
                  <span>{a.icon}</span> {a.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <p style={{ color: '#aaa', fontSize: '0.75rem', textAlign: 'center' }}>
        Dashboard auto-refreshes every 30 seconds · Last updated: {new Date().toLocaleTimeString()}
      </p>
    </div>
  );
}
