/**
 * pages/CattleHealth.jsx — Cattle registry with health records.
 */
import { useState, useEffect } from 'react';
import { cattleAPI } from '../api/endpoints';
import toast from 'react-hot-toast';
import Badge from '../components/Badge';

const statusColor = (s) => ({
  Active: 'green', Lactating: 'blue', Dry: 'gray',
  Pregnant: 'purple', Sold: 'yellow', Deceased: 'red'
}[s] || 'gray');

export default function CattleHealth() {
  const [cattle, setCattle]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]  = useState('');
  const [filter, setFilter]  = useState('');
  const [selected, setSelected] = useState(null);
  const [healthRecords, setHealthRecords] = useState([]);
  const [vaccinations, setVaccinations]   = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ tag_number:'', name:'', breed:'Holstein', date_of_birth:'' });

  useEffect(() => {
    fetchCattle();
  }, []);

  const fetchCattle = async () => {
    setLoading(true);
    try {
      const res = await cattleAPI.list({ is_active: true });
      setCattle(res.data?.results || res.data.data?.results || []);
    } catch { toast.error('Failed to load cattle.'); }
    finally { setLoading(false); }
  };

  const selectCattle = async (c) => {
    setSelected(c);
    const [hr, vc] = await Promise.all([
      cattleAPI.healthRecords(c.id),
      cattleAPI.vaccinations(c.id),
    ]);
    setHealthRecords(hr.data?.results || hr.data.data?.results || []);
    setVaccinations(vc.data?.results || vc.data.data?.results || []);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await cattleAPI.create(addForm);
      toast.success('Cattle added!');
      setShowAdd(false);
      setAddForm({ tag_number:'', name:'', breed:'Holstein', date_of_birth:'' });
      fetchCattle();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add cattle.');
    }
  };

  const displayed = cattle.filter(c =>
    (!search || c.tag_number.toLowerCase().includes(search.toLowerCase()) ||
     (c.name || '').toLowerCase().includes(search.toLowerCase())) &&
    (!filter || c.status === filter)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">🐄 Cattle Health</h1>
        <button onClick={() => setShowAdd(true)}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700">
          + Add Cattle
        </button>
      </div>

      {/* Add cattle modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-4">Add New Cattle</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <input required value={addForm.tag_number}
                onChange={e => setAddForm(f => ({ ...f, tag_number: e.target.value }))}
                placeholder="Tag Number *"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <input value={addForm.name}
                onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Name (optional)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <select value={addForm.breed}
                onChange={e => setAddForm(f => ({ ...f, breed: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {['Holstein','Jersey','Gir','Sahiwal','Murrah','Crossbreed','Other'].map(b =>
                  <option key={b}>{b}</option>)}
              </select>
              <input required type="date" value={addForm.date_of_birth}
                onChange={e => setAddForm(f => ({ ...f, date_of_birth: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowAdd(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit"
                  className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Cattle list */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 space-y-2">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by tag or name…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <select value={filter} onChange={e => setFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">All Statuses</option>
              {['Active','Lactating','Dry','Pregnant'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="overflow-y-auto max-h-[60vh] divide-y divide-gray-50">
            {loading ? (
              <div className="p-8 text-center text-gray-400">Loading…</div>
            ) : displayed.map(c => (
              <button key={c.id} onClick={() => selectCattle(c)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors
                  ${selected?.id === c.id ? 'bg-primary-50 border-l-4 border-primary-600' : ''}`}>
                <div className="flex justify-between items-start">
                  <span className="font-medium text-sm">{c.tag_number}</span>
                  <Badge label={c.status} variant={statusColor(c.status)} />
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{c.breed} · {c.age_months}mo old</div>
              </button>
            ))}
          </div>
        </div>

        {/* Cattle detail */}
        <div className="lg:col-span-3 space-y-4">
          {selected ? (
            <>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="font-bold text-lg">{selected.tag_number} — {selected.name || 'Unnamed'}</h2>
                    <p className="text-sm text-gray-500">{selected.breed} · {selected.age_months} months old</p>
                  </div>
                  <Badge label={selected.status} variant={statusColor(selected.status)} />
                </div>
              </div>

              {/* Health records */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm text-gray-800">
                  Health Records ({healthRecords.length})
                </div>
                {healthRecords.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-gray-400 text-center">No health records</p>
                ) : healthRecords.slice(0, 5).map(hr => (
                  <div key={hr.id} className="px-4 py-3 border-b border-gray-50 last:border-0">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{hr.record_type}</span>
                      <span className="text-gray-400">{hr.visit_date}</span>
                    </div>
                    {hr.diagnosis && <p className="text-xs text-gray-500 mt-0.5">{hr.diagnosis}</p>}
                  </div>
                ))}
              </div>

              {/* Vaccinations */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm text-gray-800">
                  Vaccinations ({vaccinations.length})
                </div>
                {vaccinations.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-gray-400 text-center">No vaccination records</p>
                ) : vaccinations.slice(0, 5).map(v => (
                  <div key={v.id} className="px-4 py-3 border-b border-gray-50 last:border-0 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">{v.vaccine_name}</span>
                      <Badge label={`Due: ${v.next_due_date}`} variant="purple" />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">Given: {v.administered_on}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-gray-400">
              Select a cattle from the list to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
