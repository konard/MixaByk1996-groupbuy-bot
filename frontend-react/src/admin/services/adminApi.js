/**
 * Admin API Service
 * Handles all admin-related API calls
 */

const API_URL = '/api/admin';

async function request(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Include cookies for session auth
  });

  if (response.status === 401) {
    // Redirect to admin login if unauthorized
    window.location.href = '/admin-panel/login';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const adminApi = {
  // Auth
  checkAuth: () => request('/auth/'),
  login: (username, password) =>
    request('/auth/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () =>
    request('/auth/', {
      method: 'DELETE',
    }),

  // Dashboard
  getDashboardStats: () => request('/dashboard/'),

  // Users
  getUsers: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/users/?${query}`);
  },
  getUser: (id) => request(`/users/${id}/`),
  updateUser: (id, data) =>
    request(`/users/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteUser: (id) =>
    request(`/users/${id}/`, {
      method: 'DELETE',
    }),
  toggleUserActive: (id) =>
    request(`/users/${id}/toggle_active/`, { method: 'POST' }),
  toggleUserVerified: (id) =>
    request(`/users/${id}/toggle_verified/`, { method: 'POST' }),
  updateUserBalance: (id, amount, description) =>
    request(`/users/${id}/update_balance/`, {
      method: 'POST',
      body: JSON.stringify({ amount, description }),
    }),
  bulkUserAction: (ids, action) =>
    request('/users/bulk_action/', {
      method: 'POST',
      body: JSON.stringify({ ids, action }),
    }),

  // Procurements
  getProcurements: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/procurements/?${query}`);
  },
  getProcurement: (id) => request(`/procurements/${id}/`),
  updateProcurement: (id, data) =>
    request(`/procurements/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteProcurement: (id) =>
    request(`/procurements/${id}/`, {
      method: 'DELETE',
    }),
  updateProcurementStatus: (id, status) =>
    request(`/procurements/${id}/update_status/`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  toggleProcurementFeatured: (id) =>
    request(`/procurements/${id}/toggle_featured/`, { method: 'POST' }),
  getProcurementParticipants: (id) => request(`/procurements/${id}/participants/`),
  bulkProcurementAction: (ids, action) =>
    request('/procurements/bulk_action/', {
      method: 'POST',
      body: JSON.stringify({ ids, action }),
    }),

  // Payments
  getPayments: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/payments/?${query}`);
  },
  getPayment: (id) => request(`/payments/${id}/`),
  getPaymentsSummary: () => request('/payments/summary/'),

  // Transactions
  getTransactions: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/transactions/?${query}`);
  },

  // Categories
  getCategories: () => request('/categories/'),
  createCategory: (data) =>
    request('/categories/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCategory: (id, data) =>
    request(`/categories/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteCategory: (id) =>
    request(`/categories/${id}/`, {
      method: 'DELETE',
    }),

  // Messages
  getMessages: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/messages/?${query}`);
  },
  toggleMessageDelete: (id) =>
    request(`/messages/${id}/toggle_delete/`, { method: 'POST' }),

  // Notifications
  getNotifications: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/notifications/?${query}`);
  },
  sendBulkNotification: (userIds, notificationType, title, message) =>
    request('/notifications/send_bulk/', {
      method: 'POST',
      body: JSON.stringify({
        user_ids: userIds,
        notification_type: notificationType,
        title,
        message,
      }),
    }),
};
