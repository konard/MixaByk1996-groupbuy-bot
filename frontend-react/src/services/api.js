const API_URL = '/api';

async function request(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const token = localStorage.getItem('authToken');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const api = {
  // User endpoints
  getUser: (userId) => request(`/users/${userId}/`),

  getUserByPlatform: (platform, platformUserId) =>
    request(`/users/by_platform/?platform=${platform}&platform_user_id=${platformUserId}`),

  getUserByEmail: (email) =>
    request(`/users/by_email/?email=${encodeURIComponent(email)}`),

  getUserByPhone: (phone) =>
    request(`/users/by_phone/?phone=${encodeURIComponent(phone)}`),

  registerUser: (data) =>
    request('/users/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateUser: (userId, data) =>
    request(`/users/${userId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getUserBalance: (userId) => request(`/users/${userId}/balance/`),

  // Procurement endpoints
  getProcurements: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/procurements/?${query}`);
  },

  getProcurement: (id) => request(`/procurements/${id}/`),

  createProcurement: (data) =>
    request('/procurements/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  joinProcurement: (id, data) =>
    request(`/procurements/${id}/join/`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  leaveProcurement: (id, data) =>
    request(`/procurements/${id}/leave/`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getUserProcurements: (userId) => request(`/procurements/user/${userId}/`),

  getCategories: () => request('/procurements/categories/'),

  // Procurement action endpoints
  stopProcurement: (id) =>
    request(`/procurements/${id}/stop_amount/`, { method: 'POST' }),

  approveSupplier: (id, supplierId) =>
    request(`/procurements/${id}/approve_supplier/`, {
      method: 'POST',
      body: JSON.stringify({ supplier_id: supplierId }),
    }),

  closeProcurement: (id) =>
    request(`/procurements/${id}/close/`, { method: 'POST' }),

  getReceiptTable: (id) => request(`/procurements/${id}/receipt_table/`),

  getVoteResults: (id) => request(`/procurements/${id}/vote_results/`),

  castVote: (id, data) =>
    request(`/procurements/${id}/cast_vote/`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getParticipants: (procurementId) =>
    request(`/procurements/${procurementId}/participants/`),

  updateParticipantStatus: (participantId, newStatus) =>
    request(`/procurements/participants/${participantId}/update_status/`, {
      method: 'POST',
      body: JSON.stringify({ status: newStatus }),
    }),

  // Chat endpoints
  getMessages: (procurementId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/chat/messages/?procurement_id=${procurementId}&${query}`);
  },

  sendMessage: (data) =>
    request('/chat/messages/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getNotifications: (userId) => request(`/chat/notifications/?user_id=${userId}`),

  // Payment endpoints
  createPayment: (data) =>
    request('/payments/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getPaymentStatus: (paymentId) => request(`/payments/${paymentId}/status/`),

  getTransactions: (userId) => request(`/payments/transactions/?user_id=${userId}`),

  // Supplier profile endpoints (stored as user profile extensions)
  getSuppliers: () => request('/users/?role=supplier'),

  // Chat voting endpoints
  getChatVote: (procurementId) => request(`/procurements/${procurementId}/chat_vote/`).catch(() => null),

  castChatVote: (procurementId, data) =>
    request(`/procurements/${procurementId}/cast_vote/`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  closeChatVote: (procurementId, userId) =>
    request(`/procurements/${procurementId}/close_vote/`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }).catch(() => ({ fallback: true })),

  getVoteCloseStatus: (procurementId) =>
    request(`/procurements/${procurementId}/vote_close_status/`).catch(() => null),
};
