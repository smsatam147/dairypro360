/**
 * pages/Sales.jsx — Sales orders and GST invoices.
 */
import { useState, useEffect } from 'react';
import { salesAPI } from '../api/endpoints';
import toast from 'react-hot-toast';
import Badge from '../components/Badge';

const INR = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v);

const statusColor = (s) => ({
  Draft: 'gray', Confirmed: 'blue', Dispatched: 'yellow',
  Delivered: 'green', Cancelled: 'red',
  Issued: 'blue', Paid: 'green', PartiallyPaid: 'yellow', Overdue: 'red',
}[s] || 'gray');

export default function Sales() {
  const [tab, setTab]         = useState('invoices');
  const [invoices, setInvoices] = useState([]);
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (tab === 'invoices') {
      salesAPI.invoices().then(r => setInvoices(r.data?.results || r.data.data?.results || [])).finally(() => setLoading(false));
    } else {
      salesAPI.orders().then(r => setOrders(r.data?.results || r.data.data?.results || [])).finally(() => setLoading(false));
    }
  }, [tab]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">💰 Sales & Invoicing</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {['invoices', 'orders'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors
              ${tab === t ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {tab === 'invoices' ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Invoice No.</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Due Date</th>
                <th className="px-4 py-3 text-right">Amount (INR)</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading…</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">No invoices</td></tr>
              ) : invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-primary-700">{inv.invoice_number}</td>
                  <td className="px-4 py-3">{inv.customer_name || inv.customer}</td>
                  <td className="px-4 py-3 text-gray-500">{inv.invoice_date}</td>
                  <td className="px-4 py-3 text-gray-500">{inv.due_date}</td>
                  <td className="px-4 py-3 text-right font-medium">{INR(inv.total_amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge label={inv.status} variant={statusColor(inv.status)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Order Date</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-right">Total (INR)</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400">Loading…</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400">No orders</td></tr>
              ) : orders.map(o => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{o.order_date}</td>
                  <td className="px-4 py-3">{o.customer_name || o.customer}</td>
                  <td className="px-4 py-3 text-right font-medium">{INR(o.total_amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge label={o.status} variant={statusColor(o.status)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
