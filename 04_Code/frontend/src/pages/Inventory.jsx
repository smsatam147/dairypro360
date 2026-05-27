/**
 * pages/Inventory.jsx — Stock management with reorder alerts.
 */
import { useState, useEffect } from 'react';
import { inventoryAPI } from '../api/endpoints';
import toast from 'react-hot-toast';
import Badge from '../components/Badge';

const INR = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v);

export default function Inventory() {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showLow, setShowLow]   = useState(false);
  const [showTxn, setShowTxn]   = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [txnForm, setTxnForm]   = useState({ txn_type: 'Purchase', quantity: '', notes: '' });

  useEffect(() => {
    fetchItems();
  }, [showLow]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await inventoryAPI.list(showLow ? { low_stock: true } : {});
      setItems(res.data.data?.results || []);
    } catch { toast.error('Failed to load inventory.'); }
    finally { setLoading(false); }
  };

  const handleTransaction = async (e) => {
    e.preventDefault();
    try {
      await inventoryAPI.addTransaction({
        item: selectedItem.id,
        txn_type: txnForm.txn_type,
        quantity: +txnForm.quantity,
        notes: txnForm.notes,
      });
      toast.success('Stock updated!');
      setShowTxn(false);
      setTxnForm({ txn_type: 'Purchase', quantity: '', notes: '' });
      fetchItems();
    } catch (err) {
      const msg = err.response?.data?.errors?.quantity?.[0] || err.response?.data?.message || 'Transaction failed.';
      toast.error(msg);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">📦 Inventory</h1>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showLow} onChange={e => setShowLow(e.target.checked)}
            className="rounded" />
          Show low-stock only
        </label>
      </div>

      {/* Transaction modal */}
      {showTxn && selectedItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-1">Record Transaction</h3>
            <p className="text-sm text-gray-500 mb-4">{selectedItem.name} — {selectedItem.quantity_on_hand} {selectedItem.unit} on hand</p>
            <form onSubmit={handleTransaction} className="space-y-4">
              <select value={txnForm.txn_type}
                onChange={e => setTxnForm(f => ({ ...f, txn_type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {['Purchase','Consumption','Adjustment','Return','Wastage'].map(t => <option key={t}>{t}</option>)}
              </select>
              <input required type="number" step="0.001" value={txnForm.quantity}
                onChange={e => setTxnForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder={`Quantity (${selectedItem.unit}) *`}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <input value={txnForm.notes}
                onChange={e => setTxnForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Notes (optional)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowTxn(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit"
                  className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Item</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-right">On Hand</th>
              <th className="px-4 py-3 text-right">Reorder At</th>
              <th className="px-4 py-3 text-right">Unit Cost</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No items</td></tr>
            ) : items.map(item => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-gray-400">{item.item_code}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">{item.category}</td>
                <td className="px-4 py-3 text-right font-medium">
                  {Number(item.quantity_on_hand).toFixed(1)} {item.unit}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {Number(item.reorder_level).toFixed(1)} {item.unit}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {item.unit_cost ? INR(item.unit_cost) : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge
                    label={item.is_low_stock ? 'Low Stock' : 'OK'}
                    variant={item.is_low_stock ? 'red' : 'green'}
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => { setSelectedItem(item); setShowTxn(true); }}
                    className="text-xs text-primary-600 hover:text-primary-800 font-medium">
                    + Transaction
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
