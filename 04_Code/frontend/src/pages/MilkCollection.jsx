/**
 * pages/MilkCollection.jsx — Milk entry form + daily summary + offline sync.
 * FR-M-01: Duplicate prevention | FR-M-03: Inactive cattle block | FR-AU-06: Offline
 */
import { useState, useEffect } from 'react';
import { milkAPI, cattleAPI } from '../api/endpoints';
import toast from 'react-hot-toast';
import Badge from '../components/Badge';
import { openDB } from 'idb';

// IndexedDB setup for offline entries (FR-AU-06)
const DB_NAME  = 'dairypro_offline';
const DB_STORE = 'pending_milk';

async function getOfflineDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) { db.createObjectStore(DB_STORE, { autoIncrement: true }); }
  });
}

const gradeColor = (g) => ({ A: 'green', B: 'blue', C: 'yellow', Rejected: 'red' }[g] || 'gray');

export default function MilkCollection() {
  const [cattle, setCattle]       = useState([]);
  const [summary, setSummary]     = useState(null);
  const [collections, setCollections] = useState([]);
  const [form, setForm]           = useState({
    cattle_id: '', shift: 'Morning', quantity_litres: '',
    fat_percentage: '', snf_percentage: '', notes: ''
  });
  const [errors, setErrors]       = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [isOnline, setIsOnline]   = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    cattleAPI.list({ is_active: true }).then(r => setCattle(r.data?.results || r.data?.results || r.data.data?.results || []));
    milkAPI.dailySummary(today).then(r => setSummary(r.data.data)).catch(() => {});
    milkAPI.list({ collection_date: today }).then(r => setCollections(r.data?.results || r.data.data?.results || []));

    const onOnline  = () => { setIsOnline(true); handleSync(); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    checkPending();
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  async function checkPending() {
    const db = await getOfflineDB();
    const count = await db.count(DB_STORE);
    setPendingCount(count);
  }

  async function handleSync() {
    const db      = await getOfflineDB();
    const keys    = await db.getAllKeys(DB_STORE);
    const entries = await db.getAll(DB_STORE);
    if (!entries.length) return;
    try {
      await milkAPI.syncOffline({ entries });
      for (const key of keys) await db.delete(DB_STORE, key);
      setPendingCount(0);
      toast.success(`${entries.length} offline entries synced!`);
    } catch (e) {
      toast.error('Sync failed. Will retry when online.');
    }
  }

  const validate = () => {
    const e = {};
    if (!form.cattle_id) e.cattle_id = 'Select a cattle.';
    if (!form.quantity_litres || isNaN(form.quantity_litres) || +form.quantity_litres <= 0)
      e.quantity_litres = 'Enter a valid quantity (> 0).';
    if (form.fat_percentage && (+form.fat_percentage < 0 || +form.fat_percentage > 10))
      e.fat_percentage = 'Fat% must be between 0 and 10.';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    const payload = {
      cattle: form.cattle_id,
      collection_date: today,
      shift: form.shift,
      quantity_litres: +form.quantity_litres,
      fat_percentage: form.fat_percentage || null,
      snf_percentage: form.snf_percentage || null,
      notes: form.notes,
    };

    if (!isOnline) {
      // Store offline
      const db = await getOfflineDB();
      await db.add(DB_STORE, payload);
      setPendingCount(c => c + 1);
      toast('Entry saved offline. Will sync when connected.', { icon: '📶' });
      setForm(f => ({ ...f, quantity_litres: '', fat_percentage: '', snf_percentage: '', notes: '' }));
      setSubmitting(false);
      return;
    }

    try {
      await milkAPI.create(payload);
      toast.success('Milk entry recorded!');
      setForm(f => ({ ...f, quantity_litres: '', fat_percentage: '', snf_percentage: '', notes: '' }));
      milkAPI.dailySummary(today).then(r => setSummary(r.data.data));
      milkAPI.list({ collection_date: today }).then(r => setCollections(r.data?.results || r.data.data?.results || []));
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to record entry.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">🥛 Milk Collection</h1>
        <div className="flex items-center gap-3">
          {!isOnline && <Badge label="Offline Mode" variant="red" />}
          {pendingCount > 0 && (
            <button onClick={handleSync}
              className="text-sm bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded-lg hover:bg-yellow-200">
              Sync {pendingCount} pending
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entry form */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Record Entry — {today}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Cattle *</label>
              <select value={form.cattle_id}
                onChange={e => setForm(f => ({ ...f, cattle_id: e.target.value }))}
                className={`mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500
                  ${errors.cattle_id ? 'border-red-400' : 'border-gray-300'}`}>
                <option value="">Select cattle…</option>
                {cattle.map(c => (
                  <option key={c.id} value={c.id}>{c.tag_number} — {c.name || 'Unnamed'}</option>
                ))}
              </select>
              {errors.cattle_id && <p className="text-red-500 text-xs mt-1">{errors.cattle_id}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Shift *</label>
              <select value={form.shift}
                onChange={e => setForm(f => ({ ...f, shift: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500">
                <option>Morning</option>
                <option>Evening</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Quantity (Litres) *</label>
              <input type="number" step="0.01" value={form.quantity_litres}
                onChange={e => setForm(f => ({ ...f, quantity_litres: e.target.value }))}
                className={`mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500
                  ${errors.quantity_litres ? 'border-red-400' : 'border-gray-300'}`}
                placeholder="e.g. 12.5" />
              {errors.quantity_litres && <p className="text-red-500 text-xs mt-1">{errors.quantity_litres}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Fat %</label>
                <input type="number" step="0.01" value={form.fat_percentage}
                  onChange={e => setForm(f => ({ ...f, fat_percentage: e.target.value }))}
                  className={`mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500
                    ${errors.fat_percentage ? 'border-red-400' : 'border-gray-300'}`}
                  placeholder="e.g. 4.2" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">SNF %</label>
                <input type="number" step="0.01" value={form.snf_percentage}
                  onChange={e => setForm(f => ({ ...f, snf_percentage: e.target.value }))}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g. 8.5" />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Notes</label>
              <textarea value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                placeholder="Optional notes…" />
            </div>

            <button type="submit" disabled={submitting}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-lg text-sm font-medium
                         transition-colors disabled:opacity-50">
              {submitting ? 'Recording…' : (isOnline ? 'Record Entry' : 'Save Offline')}
            </button>
          </form>
        </div>

        {/* Daily summary + table */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary */}
          {summary && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Today's Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-xl font-bold text-blue-700">{Number(summary.total_litres).toFixed(1)} L</div>
                  <div className="text-xs text-gray-500 mt-1">Total</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-xl font-bold text-green-700">{summary.cattle_count}</div>
                  <div className="text-xs text-gray-500 mt-1">Cattle</div>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <div className="text-xl font-bold text-yellow-700">{Number(summary.avg_fat_pct).toFixed(1)}%</div>
                  <div className="text-xs text-gray-500 mt-1">Avg Fat</div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-xl font-bold text-purple-700">{summary.grade_breakdown?.A || 0}</div>
                  <div className="text-xs text-gray-500 mt-1">Grade A</div>
                </div>
              </div>
            </div>
          )}

          {/* Records table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Today's Entries</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Cattle</th>
                    <th className="px-4 py-3 text-left">Shift</th>
                    <th className="px-4 py-3 text-right">Qty (L)</th>
                    <th className="px-4 py-3 text-right">Fat%</th>
                    <th className="px-4 py-3 text-center">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {collections.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No entries today</td></tr>
                  ) : collections.map(mc => (
                    <tr key={mc.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium">{mc.cattle_detail?.tag_number || mc.cattle}</td>
                      <td className="px-4 py-2.5 text-gray-600">{mc.shift}</td>
                      <td className="px-4 py-2.5 text-right">{Number(mc.quantity_litres).toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right">{mc.fat_percentage || '—'}</td>
                      <td className="px-4 py-2.5 text-center">
                        {mc.quality_grade ? <Badge label={mc.quality_grade} variant={gradeColor(mc.quality_grade)} /> : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
