/**
 * pages/Dashboard.jsx — Executive KPI dashboard with auto-refresh (FR-R-01).
 */
import { useState, useEffect, useCallback } from 'react';
import { reportsAPI } from '../api/endpoints';
import StatCard from '../components/StatCard';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Title, Tooltip, Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const REFRESH_MS = 30_000;  // 30-second auto-refresh

const INR = (v) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0
}).format(v);

export default function Dashboard() {
  const [kpis, setKpis]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchKPIs = useCallback(async () => {
    try {
      const res = await reportsAPI.dashboard();
      setKpis(res.data.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKPIs();
    const interval = setInterval(fetchKPIs, REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchKPIs]);

  const barData = {
    labels: ['Revenue', 'Payroll'],
    datasets: [{
      label: 'This Month (INR)',
      data: kpis ? [kpis.monthly_revenue, kpis.monthly_payroll_expense] : [0, 0],
      backgroundColor: ['rgba(59,130,246,0.7)', 'rgba(239,68,68,0.7)'],
      borderRadius: 6,
    }],
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Executive Dashboard</h1>
          <p className="text-gray-500 text-sm">Auto-refreshes every 30 seconds</p>
        </div>
        {lastUpdated && (
          <span className="text-xs text-gray-400">
            Updated: {lastUpdated.toLocaleTimeString('en-IN')}
          </span>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Today's Milk Collection"
                  value={kpis ? `${kpis.today_milk_litres.toFixed(1)} L` : '—'}
                  icon="🥛" color="blue" loading={loading} />
        <StatCard title="Active Cattle"
                  value={kpis?.active_cattle ?? '—'}
                  icon="🐄" color="green" loading={loading} />
        <StatCard title="Open Invoices"
                  value={kpis ? `${kpis.open_invoices} (${INR(kpis.open_invoices_value)})` : '—'}
                  icon="📄" color="yellow" loading={loading} />
        <StatCard title="Low Stock Items"
                  value={kpis?.low_stock_items ?? '—'}
                  sub={kpis?.low_stock_items > 0 ? 'Reorder required' : 'All stocked'}
                  icon="📦" color={kpis?.low_stock_items > 0 ? 'red' : 'green'} loading={loading} />
        <StatCard title="Pending Vaccinations"
                  value={kpis?.pending_vaccinations ?? '—'}
                  sub="Due in 7 days"
                  icon="💉" color="purple" loading={loading} />
        <StatCard title="Monthly Revenue"
                  value={kpis ? INR(kpis.monthly_revenue) : '—'}
                  icon="💰" color="green" loading={loading} />
        <StatCard title="Monthly Payroll"
                  value={kpis ? INR(kpis.monthly_payroll_expense) : '—'}
                  icon="👥" color="yellow" loading={loading} />
        <StatCard title="Profit Estimate"
                  value={kpis ? INR(kpis.monthly_revenue - kpis.monthly_payroll_expense) : '—'}
                  sub="Revenue - Payroll"
                  icon="📈" color="blue" loading={loading} />
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Monthly Financial Overview</h2>
        <div className="h-64">
          <Bar data={barData} options={{
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true } },
          }} />
        </div>
      </div>
    </div>
  );
}
