/** Reusable KPI stat card for dashboard. */
export default function StatCard({ title, value, sub, icon, color = 'blue', loading }) {
  const colorMap = {
    blue:   'bg-blue-50 text-blue-700 border-blue-200',
    green:  'bg-green-50 text-green-700 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    red:    'bg-red-50 text-red-700 border-red-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };
  return (
    <div className={`rounded-xl border p-5 ${colorMap[color]} shadow-sm`}>
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        {loading && <span className="text-xs opacity-60">Loading…</span>}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold">
          {loading ? '—' : value}
        </div>
        <div className="text-sm font-medium mt-1">{title}</div>
        {sub && <div className="text-xs opacity-70 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}
