import { useState, useEffect } from 'react';
import { createCollection, getCollections, getCollectionSummary } from '../api/endpoints';
import toast from 'react-hot-toast';

const initialForm = {
  farmer_id: '', collection_date: new Date().toISOString().slice(0,10),
  shift: 'AM', quantity_L: '', fat_pct: '', snf_pct: '', clr: '', temperature_C: ''
};

export default function MilkCollection() {
  const [form, setForm] = useState(initialForm);
  const [collections, setCollections] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('form'); // 'form' | 'list' | 'summary'

  useEffect(() => {
    loadCollections();
    loadSummary();
  }, []);

  const loadCollections = async () => {
    try {
      const { data } = await getCollections({ limit: 20 });
      setCollections(data.data || []);
    } catch { toast.error('Failed to load collections'); }
  };

  const loadSummary = async () => {
    try {
      const { data } = await getCollectionSummary({});
      setSummary(data);
    } catch {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await createCollection(form);
      if (data.collection.quality_status === 'Reject') {
        toast.error(`❌ REJECTED: ${data.quality_check.reason}`);
      } else {
        toast.success(`✅ Collection recorded! Payment: ₹${data.payment?.total}`);
      }
      setForm(initialForm);
      loadCollections();
      loadSummary();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to record collection');
    } finally { setLoading(false); }
  };

  const getStatusBadge = (status) => ({
    background: status === 'Pass' ? '#27ae60' : '#e74c3c',
    color: 'white', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700
  });

  return (
    <div style={{ padding: '2rem', background: '#f5f7fa', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, color: '#1a3c5e' }}>🥛 Milk Collection</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['form', 'list', 'summary'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '0.5rem 1rem', borderRadius: 8, border: '1.5px solid #1a3c5e',
              background: tab === t ? '#1a3c5e' : 'white',
              color: tab === t ? 'white' : '#1a3c5e',
              cursor: 'pointer', fontWeight: 600, textTransform: 'capitalize'
            }}>{t === 'form' ? '+ New Entry' : t === 'list' ? 'History' : '📊 Summary'}</button>
          ))}
        </div>
      </div>

      {tab === 'form' && (
        <div style={{ background: 'white', borderRadius: 12, padding: '2rem', maxWidth: 600, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <h3 style={{ margin: '0 0 1.5rem', color: '#1a3c5e' }}>Record Milk Collection</h3>
          <form onSubmit={handleSubmit}>
            {[
              { label: 'Farmer ID', key: 'farmer_id', type: 'number', required: true },
              { label: 'Collection Date', key: 'collection_date', type: 'date', required: true },
              { label: 'Quantity (Litres)', key: 'quantity_L', type: 'number', step: '0.01', required: true },
              { label: 'Fat %', key: 'fat_pct', type: 'number', step: '0.01', required: true },
              { label: 'SNF %', key: 'snf_pct', type: 'number', step: '0.01', required: true },
              { label: 'CLR', key: 'clr', type: 'number', step: '0.01' },
              { label: 'Temperature (°C)', key: 'temperature_C', type: 'number', step: '0.1' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, color: '#555', fontSize: '0.9rem' }}>
                  {f.label}{f.required && <span style={{ color: '#e74c3c' }}>*</span>}
                </label>
                <input
                  type={f.type} step={f.step} required={f.required}
                  value={form[f.key]} placeholder={f.label}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  style={{ width: '100%', padding: '0.7rem', border: '1.5px solid #ddd', borderRadius: 8, fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, color: '#555', fontSize: '0.9rem' }}>
                Shift<span style={{ color: '#e74c3c' }}>*</span>
              </label>
              <select value={form.shift} onChange={e => setForm({ ...form, shift: e.target.value })}
                style={{ width: '100%', padding: '0.7rem', border: '1.5px solid #ddd', borderRadius: 8, fontSize: '0.95rem' }}>
                <option value="AM">Morning (AM)</option>
                <option value="PM">Evening (PM)</option>
              </select>
            </div>

            <div style={{ background: '#f0f7ff', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#1a3c5e' }}>
              <strong>Quality Thresholds:</strong> Fat ≥ 3.0% | SNF ≥ 8.0% | Temp ≤ 10°C<br/>
              <strong>Rate:</strong> Base ₹27/L + ₹0.5 per 0.1% fat above 4.0%
            </div>

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '0.85rem', background: loading ? '#ccc' : '#1a3c5e',
              color: 'white', border: 'none', borderRadius: 8, fontSize: '1rem',
              fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer'
            }}>
              {loading ? 'Recording...' : 'Record Collection'}
            </button>
          </form>
        </div>
      )}

      {tab === 'list' && (
        <div style={{ background: 'white', borderRadius: 12, padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <h3 style={{ margin: '0 0 1rem', color: '#1a3c5e' }}>Recent Collections</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: '#1a3c5e', color: 'white' }}>
                  {['Batch ID','Farmer','Date','Shift','Qty (L)','Fat%','SNF%','Status','Payment ₹'].map(h => (
                    <th key={h} style={{ padding: '0.75rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {collections.map((c, i) => (
                  <tr key={c.id} style={{ background: i%2===0?'white':'#f5f7fa' }}>
                    <td style={{ padding: '0.6rem' }}><code style={{ fontSize: '0.8rem' }}>{c.batch_id}</code></td>
                    <td style={{ padding: '0.6rem' }}>{c.farmer_name || `Farmer #${c.farmer_id}`}</td>
                    <td style={{ padding: '0.6rem' }}>{new Date(c.collection_date).toLocaleDateString('en-IN')}</td>
                    <td style={{ padding: '0.6rem' }}>{c.shift}</td>
                    <td style={{ padding: '0.6rem', fontWeight: 600 }}>{c.quantity_l}</td>
                    <td style={{ padding: '0.6rem' }}>{c.fat_pct}%</td>
                    <td style={{ padding: '0.6rem' }}>{c.snf_pct}%</td>
                    <td style={{ padding: '0.6rem' }}><span style={getStatusBadge(c.quality_status)}>{c.quality_status}</span></td>
                    <td style={{ padding: '0.6rem', fontWeight: 600, color: '#27ae60' }}>
                      {c.payment_amount ? `₹${parseFloat(c.payment_amount).toFixed(2)}` : '—'}
                    </td>
                  </tr>
                ))}
                {collections.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>No collections found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'summary' && summary && (
        <div style={{ background: 'white', borderRadius: 12, padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <h3 style={{ margin: '0 0 0.25rem', color: '#1a3c5e' }}>Daily Collection Summary</h3>
          <p style={{ color: '#666', margin: '0 0 1rem', fontSize: '0.9rem' }}>Date: {summary.date}</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: '#eaf2fb', padding: '1rem', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1a3c5e' }}>{parseFloat(summary.totals?.total_l||0).toFixed(1)} L</div>
              <div style={{ color: '#666', fontSize: '0.85rem' }}>Total Collected</div>
            </div>
            <div style={{ background: '#eafaf1', padding: '1rem', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#27ae60' }}>₹{parseFloat(summary.totals?.total_payment||0).toFixed(0)}</div>
              <div style={{ color: '#666', fontSize: '0.85rem' }}>Total Payment</div>
            </div>
            <div style={{ background: '#fef9f9', padding: '1rem', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#e74c3c' }}>{summary.totals?.rejections || 0}</div>
              <div style={{ color: '#666', fontSize: '0.85rem' }}>Rejections</div>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#1a3c5e', color: 'white' }}>
                {['Farmer','Code','Total L','Avg Fat%','Avg SNF%','Payment ₹','Rejections'].map(h => (
                  <th key={h} style={{ padding: '0.6rem', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(summary.farmers || []).map((f, i) => (
                <tr key={i} style={{ background: i%2===0?'white':'#f5f7fa' }}>
                  <td style={{ padding: '0.6rem', fontWeight: 600 }}>{f.farmer_name}</td>
                  <td style={{ padding: '0.6rem' }}>{f.code}</td>
                  <td style={{ padding: '0.6rem' }}>{parseFloat(f.total_l||0).toFixed(1)}</td>
                  <td style={{ padding: '0.6rem' }}>{parseFloat(f.avg_fat||0).toFixed(2)}%</td>
                  <td style={{ padding: '0.6rem' }}>{parseFloat(f.avg_snf||0).toFixed(2)}%</td>
                  <td style={{ padding: '0.6rem', color: '#27ae60', fontWeight: 600 }}>₹{parseFloat(f.total_payment||0).toFixed(2)}</td>
                  <td style={{ padding: '0.6rem', color: f.rejections>0?'#e74c3c':'#27ae60' }}>{f.rejections}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
