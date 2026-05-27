import API from './axios';

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (data) => API.post('/auth/login', data);
export const getMe = () => API.get('/auth/me');
export const changePassword = (data) => API.put('/auth/change-password', data);

// ── Cattle ────────────────────────────────────────────────────────────────────
export const getCattle = (params) => API.get('/cattle', { params });
export const getCattleById = (id) => API.get(`/cattle/${id}`);
export const createCattle = (data) => API.post('/cattle', data);
export const updateCattle = (id, data) => API.put(`/cattle/${id}`, data);
export const getCattleYield = (id) => API.get(`/cattle/${id}/yield`);
export const addYieldLog = (id, data) => API.post(`/cattle/${id}/yield`, data);

// ── Milk Collection ───────────────────────────────────────────────────────────
export const getCollections = (params) => API.get('/collection', { params });
export const createCollection = (data) => API.post('/collection', data);
export const getCollectionSummary = (params) => API.get('/collection/summary', { params });

// ── Production ────────────────────────────────────────────────────────────────
export const getBatches = (params) => API.get('/production/batch', { params });
export const createBatch = (data) => API.post('/production/batch', data);
export const completeBatch = (id, data) => API.put(`/production/batch/${id}/complete`, data);

// ── Inventory ─────────────────────────────────────────────────────────────────
export const getInventory = (params) => API.get('/inventory', { params });
export const createInventoryItem = (data) => API.post('/inventory', data);
export const addTransaction = (id, data) => API.post(`/inventory/${id}/transaction`, data);

// ── Delivery ──────────────────────────────────────────────────────────────────
export const getDeliverySchedule = (params) => API.get('/delivery/schedule', { params });
export const createDelivery = (data) => API.post('/delivery', data);
export const updateDeliveryStatus = (id, data) => API.put(`/delivery/${id}/status`, data);
export const confirmDelivery = (id, data) => API.put(`/delivery/${id}/confirm`, data);

// ── Invoices ──────────────────────────────────────────────────────────────────
export const getInvoices = (params) => API.get('/invoices', { params });
export const createInvoice = (data) => API.post('/invoices', data);
export const recordPayment = (id, data) => API.put(`/invoices/${id}/payment`, data);

// ── HR ────────────────────────────────────────────────────────────────────────
export const getEmployees = () => API.get('/hr/employees');
export const createEmployee = (data) => API.post('/hr/employees', data);
export const markAttendance = (data) => API.post('/hr/attendance', data);
export const runPayroll = (data) => API.post('/hr/payroll/run', data);

// ── Reports ───────────────────────────────────────────────────────────────────
export const getDashboard = () => API.get('/reports/dashboard');
export const getCollectionTrend = (params) => API.get('/reports/collection-trend', { params });
export const getFarmerContribution = (params) => API.get('/reports/farmer-contribution', { params });
export const getDemandForecast = () => API.get('/reports/demand-forecast');

// ── Users ─────────────────────────────────────────────────────────────────────
export const getUsers = () => API.get('/users');
export const createUser = (data) => API.post('/users', data);
export const toggleUserActive = (id) => API.put(`/users/${id}/toggle-active`);
export const getAuditLog = (params) => API.get('/users/audit-log', { params });
