/**
 * pages/FinancialReports.jsx — Chart of Accounts + Journal Entries.
 */
import { useState, useEffect } from 'react';
import { financeAPI } from '../api/endpoints';
import toast from 'react-hot-toast';
import Badge from '../components/Badge';

const INR = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v);
const typeColor = (t) => ({
  Asset: 'green', Liability: 'red', Equity: 'purple', Revenue: 'blue', Expense: 'yellow'
}[t] || 'gray');

export default function FinancialReports() {
  const [tab, setTab]       = useState('accounts');
  const [accounts, setAccounts] = useState([]);
  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [entryLines, setEntryLines] = useState([]);

  useEffect(() => {
    setLoading(true);
    if (tab === 'accounts') {
      financeAPI.accounts().then(r => setAccounts(r.data?.results || r.data.data?.results || [])).finally(() => setLoading(false));
    } else {
      financeAPI.journalEntries().then(r => setEntries(r.data?.results || r.data.data?.results || [])).finally(() => setLoading(false));
    }
  }, [tab]);

  const viewEntry = async (entry) => {
    setSelected(entry);
    const res = await financeAPI.getEntry(entry.id);
    setEntryLines(res.data.data?.lines || []);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">📈 Financial Reports</h1>

      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {['accounts','journal'].map(t => (
          <button key={t} onClick={() => { setTab(t); setSelected(null); setLoading(true); }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors
              ${tab === t ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'accounts' ? 'Chart of Accounts' : 'Journal Entries'}
          </button>
        ))}
      </div>

      {tab === 'accounts' ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Account Name</th>
                <th className="px-4 py-3 text-center">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? <tr><td colSpan={3} className="text-center py-8 text-gray-400">Loading…</td></tr>
              : accounts.map(acc => (
                <tr key={acc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{acc.account_code}</td>
                  <td className="px-4 py-3 font-medium">{acc.account_name}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge label={acc.account_type} variant={typeColor(acc.account_type)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Entries list */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-50 max-h-[70vh] overflow-y-auto">
              {loading ? <p className="p-8 text-center text-gray-400">Loading…</p>
              : entries.map(e => (
                <button key={e.id} onClick={() => viewEntry(e)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50
                    ${selected?.id === e.id ? 'bg-primary-50 border-l-4 border-primary-600' : ''}`}>
                  <div className="flex justify-between text-sm">
                    <span className="font-mono text-xs font-medium text-primary-600">{e.entry_number}</span>
                    <span className="text-gray-400 text-xs">{e.entry_date}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5 truncate">{e.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Entry detail */}
          <div className="lg:col-span-3">
            {selected ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-1">{selected.entry_number}</h2>
                <p className="text-sm text-gray-500 mb-4">{selected.description}</p>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Account</th>
                      <th className="px-3 py-2 text-right">Debit</th>
                      <th className="px-3 py-2 text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {entryLines.map((line, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2">{line.account_name || line.account}</td>
                        <td className="px-3 py-2 text-right">{+line.debit > 0 ? INR(line.debit) : '—'}</td>
                        <td className="px-3 py-2 text-right">{+line.credit > 0 ? INR(line.credit) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 font-semibold">
                    <tr>
                      <td className="px-3 py-2 text-xs">Total</td>
                      <td className="px-3 py-2 text-right text-xs">
                        {INR(entryLines.reduce((s, l) => s + +l.debit, 0))}
                      </td>
                      <td className="px-3 py-2 text-right text-xs">
                        {INR(entryLines.reduce((s, l) => s + +l.credit, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-gray-400">
                Select an entry to view details
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
