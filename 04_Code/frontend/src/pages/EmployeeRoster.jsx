/**
 * pages/EmployeeRoster.jsx — Employee list + payroll management.
 */
import { useState, useEffect } from 'react';
import { hrAPI } from '../api/endpoints';
import toast from 'react-hot-toast';
import Badge from '../components/Badge';

const INR = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v);

const payrollStatusColor = (s) => ({
  Draft: 'gray', Approved: 'green', Disbursed: 'blue'
}[s] || 'gray');

export default function EmployeeRoster() {
  const [tab, setTab]         = useState('employees');
  const [employees, setEmployees] = useState([]);
  const [payrollRuns, setPayrollRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPayroll, setShowPayroll] = useState(false);
  const [payrollForm, setPayrollForm] = useState({
    month: new Date().getMonth() + 1, year: new Date().getFullYear()
  });

  useEffect(() => {
    if (tab === 'employees') {
      hrAPI.employees().then(r => setEmployees(r.data?.results || r.data.data?.results || [])).finally(() => setLoading(false));
    } else {
      hrAPI.payrollRuns().then(r => setPayrollRuns(r.data?.results || r.data.data?.results || [])).finally(() => setLoading(false));
    }
  }, [tab]);

  const handleStartPayroll = async (e) => {
    e.preventDefault();
    try {
      const res = await hrAPI.startPayroll(payrollForm);
      toast.success(res.data.message);
      setShowPayroll(false);
      hrAPI.payrollRuns().then(r => setPayrollRuns(r.data?.results || r.data.data?.results || []));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start payroll.');
    }
  };

  const handleApprove = async (id) => {
    try {
      await hrAPI.approvePayroll(id);
      toast.success('Payroll approved!');
      hrAPI.payrollRuns().then(r => setPayrollRuns(r.data?.results || r.data.data?.results || []));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approval failed.');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">👥 Employee Roster</h1>
        {tab === 'payroll' && (
          <button onClick={() => setShowPayroll(true)}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700">
            Run Payroll
          </button>
        )}
      </div>

      {/* Start Payroll Modal */}
      {showPayroll && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-4">Start Payroll Run</h3>
            <form onSubmit={handleStartPayroll} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Month</label>
                  <select value={payrollForm.month}
                    onChange={e => setPayrollForm(f => ({ ...f, month: +e.target.value }))}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {Array.from({length:12},(_,i) => <option key={i+1} value={i+1}>{i+1}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Year</label>
                  <input type="number" value={payrollForm.year}
                    onChange={e => setPayrollForm(f => ({ ...f, year: +e.target.value }))}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <p className="text-xs text-gray-500">Payroll will be calculated asynchronously (PF 12%, ESI 0.75%/3.25%).</p>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowPayroll(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit"
                  className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">Start</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {['employees','payroll'].map(t => (
          <button key={t} onClick={() => { setTab(t); setLoading(true); }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors
              ${tab === t ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'employees' ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left">Designation</th>
                <th className="px-4 py-3 text-left">Department</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-right">Basic Salary</th>
                <th className="px-4 py-3 text-center">PF</th>
                <th className="px-4 py-3 text-center">ESI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading…</td></tr>
              ) : employees.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{emp.full_name}</div>
                    <div className="text-xs text-gray-400">{emp.employee_code}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{emp.designation || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{emp.department || '—'}</td>
                  <td className="px-4 py-3"><Badge label={emp.employment_type} variant="blue" /></td>
                  <td className="px-4 py-3 text-right font-medium">{INR(emp.basic_salary)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge label={emp.pf_enrolled ? 'Yes' : 'No'} variant={emp.pf_enrolled ? 'green' : 'gray'} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge label={emp.esi_enrolled ? 'Yes' : 'No'} variant={emp.esi_enrolled ? 'green' : 'gray'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {loading ? <p className="text-gray-400">Loading…</p>
          : payrollRuns.map(run => (
            <div key={run.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{run.month}/{run.year} Payroll Run</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Net: {INR(run.total_net)} | PF: {INR(run.total_pf)} | ESI: {INR(run.total_esi)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge label={run.status} variant={payrollStatusColor(run.status)} />
                  {run.status === 'Draft' && (
                    <button onClick={() => handleApprove(run.id)}
                      className="text-xs bg-green-100 text-green-800 px-3 py-1.5 rounded-lg hover:bg-green-200">
                      Approve
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
