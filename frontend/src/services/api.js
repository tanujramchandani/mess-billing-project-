import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle 401 and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');

      if (refreshToken) {
        try {
          const response = await axios.post('/api/auth/token/refresh/', {
            refresh: refreshToken,
          });
          const { access } = response.data;
          localStorage.setItem('access_token', access);
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return api(originalRequest);
        } catch (refreshError) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      } else {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// ==================== AUTH ====================
export const authAPI = {
  login: (credentials) => api.post('/auth/login/', credentials),
  register: (data) => api.post('/auth/register/', data),
  refreshToken: (refresh) => api.post('/auth/token/refresh/', { refresh }),
  getProfile: () => api.get('/auth/profile/'),
  updateProfile: (data) => api.put('/auth/profile/', data),
  changePassword: (data) => api.post('/auth/change-password/', data),
};

// ==================== ATTENDANCE ====================
export const attendanceAPI = {
  list: (params) => api.get('/attendance/', { params }),
  getById: (id) => api.get(`/attendance/${id}/`),
  markAttendance: (data) => api.post('/attendance/', data),
  markBulk: (data) => api.post('/attendance/bulk/', data),
  getMyAttendance: (params) => api.get('/attendance/my/', { params }),
  getSummary: (params) => api.get('/attendance/summary/', { params }),
  getStudentDetail: (params) => api.get('/attendance/student-detail/', { params }),
  getStudents: (params) => api.get('/auth/students/', { params }),
};

// ==================== MESS RATES ====================
export const messRatesAPI = {
  list: (params) => api.get('/mess-rates/', { params }),
  getById: (id) => api.get(`/mess-rates/${id}/`),
  create: (data) => api.post('/mess-rates/', data),
  update: (id, data) => api.put(`/mess-rates/${id}/`, data),
  getActive: () => api.get('/mess-rates/active/'),
};

// ==================== BILLS ====================
export const billsAPI = {
  list: (params) => api.get('/bills/', { params }),
  getById: (id) => api.get(`/bills/${id}/`),
  generate: (data) => api.post('/bills/generate/', data),
  preview: (data) => api.post('/bills/preview/', data),
  summary: (params) => api.get('/bills/summary/', { params }),
  getMyBills: (params) => api.get('/bills/my/', { params }),
  getMyBillSummary: () => api.get('/bills/my/summary/'),
  getMyBillDetail: (id) => api.get(`/bills/my/${id}/`),
  getDetail: (id) => api.get(`/bills/${id}/`),
  export: (params) => api.get('/bills/export/', { params, responseType: 'blob' }),
};

// ==================== BILLING CYCLES ====================
export const billingCyclesAPI = {
  list: (params) => api.get('/bills/cycles/', { params }),
  getById: (id) => api.get(`/bills/cycles/${id}/`),
  create: (data) => api.post('/bills/cycles/', data),
  update: (id, data) => api.put(`/bills/cycles/${id}/`, data),
  getCurrent: (params) => api.get('/bills/cycles/current/', { params }),
  updateStatus: (id, status) => api.post(`/bills/cycles/${id}/status/`, { status }),
};

// ==================== DISPUTES ====================
export const disputesAPI = {
  list: (params) => api.get('/disputes/', { params }),
  getById: (id) => api.get(`/disputes/${id}/`),
  create: (data) => api.post('/disputes/', data),
  respond: (id, data) => api.post(`/disputes/${id}/respond/`, data),
  resolve: (id, data) => api.post(`/disputes/${id}/resolve/`, data),
  reject: (id, data) => api.post(`/disputes/${id}/reject/`, data),
  reopen: (id, data) => api.post(`/disputes/${id}/reopen/`, data),
  getMyDisputes: (params) => api.get('/disputes/my/', { params }),
  summary: (params) => api.get('/disputes/summary/', { params }),
};

// ==================== PAYMENTS ====================
export const paymentsAPI = {
  list: (params) => api.get('/payments/', { params }),
  getById: (id) => api.get(`/payments/${id}/`),
  summary: (params) => api.get('/payments/summary/', { params }),
  getMyPaymentSummary: () => api.get('/payments/my/summary/'),
  exportMyPayments: () => api.get('/payments/my/export/', { responseType: 'blob' }),
  submit: (data) => {
    const formData = new FormData();
    Object.keys(data).forEach((key) => {
      if (data[key] !== null && data[key] !== undefined) {
        formData.append(key, data[key]);
      }
    });
    return api.post('/payments/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  verify: (id, data) => api.post(`/payments/${id}/verify/`, data),
  reject: (id, data) => api.post(`/payments/${id}/reject/`, data),
  getMyPayments: (params) => api.get('/payments/my/', { params }),
};

// ==================== AUDIT LOGS ====================
export const auditLogsAPI = {
  list: (params) => api.get('/audit-logs/', { params }),
  getById: (id) => api.get(`/audit-logs/${id}/`),
};

// ==================== ANALYTICS ====================
export const analyticsAPI = {
  getDashboardStats: () => api.get('/analytics/dashboard/'),
  getAttendanceTrends: (params) => api.get('/analytics/attendance-trends/', { params }),
  getBillingSummary: (params) => api.get('/analytics/billing-summary/', { params }),
  getDisputeStats: () => api.get('/analytics/dispute-stats/'),
  getPaymentStats: () => api.get('/analytics/payment-stats/'),
  getHostelRevenue: (params) => api.get('/analytics/hostel-revenue/', { params }),
  getMonthlySummary: (params) => api.get('/analytics/monthly-summary/', { params }),
  // Student-specific
  getStudentFinancialSummary: () => api.get('/analytics/student/financial-summary/'),
  getStudentAttendanceSummary: (params) => api.get('/analytics/student/attendance-summary/', { params }),
};

// ==================== USERS (Warden) ====================
export const usersAPI = {
  list: (params) => api.get('/auth/users/', { params }),
  getById: (id) => api.get(`/auth/users/${id}/`),
  update: (id, data) => api.put(`/auth/users/${id}/`, data),
};

export default api;
