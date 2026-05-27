/**
 * api/endpoints.js — All API call functions, one per backend app.
 */
import api from './axios';

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  login:          (data)     => api.post('/auth/login/', data),
  logout:         ()         => api.post('/auth/logout/'),
  me:             ()         => api.get('/auth/me/'),
  changePassword: (data)     => api.post('/auth/change-password/', data),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersAPI = {
  list:   (params) => api.get('/users/', { params }),
  create: (data)   => api.post('/users/', data),
  get:    (id)     => api.get(`/users/${id}/`),
  update: (id, d)  => api.put(`/users/${id}/`, d),
  delete: (id)     => api.delete(`/users/${id}/`),
};

// ── Cattle ────────────────────────────────────────────────────────────────────
export const cattleAPI = {
  list:    (params) => api.get('/cattle/', { params }),
  create:  (data)   => api.post('/cattle/', data),
  get:     (id)     => api.get(`/cattle/${id}/`),
  update:  (id, d)  => api.put(`/cattle/${id}/`, d),
  delete:  (id, d)  => api.delete(`/cattle/${id}/`, { data: d }),
  healthRecords:    (cid, p) => api.get(`/cattle/${cid}/health-records/`, { params: p }),
  addHealthRecord:  (cid, d) => api.post(`/cattle/${cid}/health-records/`, d),
  vaccinations:     (cid)    => api.get(`/cattle/${cid}/vaccinations/`),
  addVaccination:   (cid, d) => api.post(`/cattle/${cid}/vaccinations/`, d),
  breedingRecords:  (cid)    => api.get(`/cattle/${cid}/breeding-records/`),
  addBreedingRecord:(cid, d) => api.post(`/cattle/${cid}/breeding-records/`, d),
};

// ── Milk ──────────────────────────────────────────────────────────────────────
export const milkAPI = {
  list:         (params) => api.get('/milk/collections/', { params }),
  create:       (data)   => api.post('/milk/collections/', data),
  syncOffline:  (data)   => api.post('/milk/collections/sync/', data),
  dailySummary: (date)   => api.get('/milk/summary/daily/', { params: { date } }),
};

// ── Inventory ─────────────────────────────────────────────────────────────────
export const inventoryAPI = {
  list:         (params) => api.get('/inventory/items/', { params }),
  create:       (data)   => api.post('/inventory/items/', data),
  get:          (id)     => api.get(`/inventory/items/${id}/`),
  update:       (id, d)  => api.put(`/inventory/items/${id}/`, d),
  addTransaction:(data)  => api.post('/inventory/transactions/', data),
};

// ── Sales ─────────────────────────────────────────────────────────────────────
export const salesAPI = {
  customers:    (p)      => api.get('/sales/customers/', { params: p }),
  addCustomer:  (data)   => api.post('/sales/customers/', data),
  orders:       (p)      => api.get('/sales/orders/', { params: p }),
  createOrder:  (data)   => api.post('/sales/orders/', data),
  invoices:     (p)      => api.get('/sales/invoices/', { params: p }),
  createInvoice:(data)   => api.post('/sales/invoices/', data),
  getInvoice:   (id)     => api.get(`/sales/invoices/${id}/`),
};

// ── HR ────────────────────────────────────────────────────────────────────────
export const hrAPI = {
  employees:     (p)     => api.get('/hr/employees/', { params: p }),
  createEmployee:(data)  => api.post('/hr/employees/', data),
  attendance:    (p)     => api.get('/hr/attendance/', { params: p }),
  addAttendance: (data)  => api.post('/hr/attendance/', data),
  payrollRuns:   ()      => api.get('/hr/payroll-runs/'),
  startPayroll:  (data)  => api.post('/hr/payroll-runs/', data),
  getPayrollRun: (id)    => api.get(`/hr/payroll-runs/${id}/`),
  approvePayroll:(id)    => api.post(`/hr/payroll-runs/${id}/approve/`),
};

// ── Finance ───────────────────────────────────────────────────────────────────
export const financeAPI = {
  accounts:       (p)    => api.get('/finance/accounts/', { params: p }),
  createAccount:  (data) => api.post('/finance/accounts/', data),
  journalEntries: (p)    => api.get('/finance/journal-entries/', { params: p }),
  createEntry:    (data) => api.post('/finance/journal-entries/', data),
  getEntry:       (id)   => api.get(`/finance/journal-entries/${id}/`),
};

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportsAPI = {
  dashboard: ()      => api.get('/reports/dashboard/'),
  auditLog:  (p)     => api.get('/reports/audit-log/', { params: p }),
};
