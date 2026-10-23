import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token & active Workspace ID
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('crm_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const currentWs = localStorage.getItem('crm_workspace');
    if (currentWs) {
      try {
        const parsed = JSON.parse(currentWs);
        if (parsed?._id) {
          config.headers['x-workspace-id'] = parsed._id;
        }
      } catch (e) {
        // ignore json parse error
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401 unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Check if not already on login page
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('crm_token');
        localStorage.removeItem('crm_user');
      }
    }
    return Promise.reject(error);
  }
);

// API Service Modules
export const authApi = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  googleLogin: (data) => api.post('/auth/google', data),
  checkEmail: (email) => api.post('/auth/check-email', { email }),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (token, data) => api.post(`/auth/reset-password/${token}`, data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
};

export const dashboardApi = {
  getOverview: () => api.get('/dashboard/overview'),
  getEmployeeStats: (params) => api.get('/dashboard/employee-stats', { params }),
};

export const projectApi = {
  getAll: (params) => api.get('/projects', { params }),
  getById: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
};

export const taskApi = {
  getAll: (params) => api.get('/tasks', { params }),
  getById: (id) => api.get(`/tasks/${id}`),
  create: (data) => api.post('/tasks', data),
  update: (id, data) => api.put(`/tasks/${id}`, data),
  updateStatus: (id, status, order) => api.patch(`/tasks/${id}/status`, { status, order }),
  submitReview: (id, data) => api.put(`/tasks/${id}/submit-review`, data),
  reviewTask: (id, data) => api.put(`/tasks/${id}/review`, data),
  delete: (id) => api.delete(`/tasks/${id}`),
};

export const userApi = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  updateRole: (id, data) => api.patch(`/users/${id}/role`, data),
};

export const roleApi = {
  getAll: (params) => api.get('/roles', { params }),
  getMyPermissions: () => api.get('/roles/my-permissions'),
  create: (data) => api.post('/roles', data),
  update: (id, data) => api.put(`/roles/${id}`, data),
  delete: (id) => api.delete(`/roles/${id}`),
  resetDefaults: () => api.post('/roles/reset-defaults'),
};

export const departmentApi = {
  getAll: (params) => api.get('/departments', { params }),
  getTree: () => api.get('/departments/tree'),
  getById: (id) => api.get(`/departments/${id}`),
  getTasks: (id) => api.get(`/departments/${id}/tasks`),
  create: (data) => api.post('/departments', data),
  update: (id, data) => api.put(`/departments/${id}`, data),
  delete: (id) => api.delete(`/departments/${id}`),
};

export const messageApi = {
  getChannels: () => api.get('/messages/channels'),
  getMessages: (channelType, channelId, params) =>
    api.get(`/messages/${channelType}/${channelId}`, { params }),
  sendMessage: (channelType, channelId, data) =>
    api.post(`/messages/${channelType}/${channelId}`, data),
  uploadAttachment: (formData) =>
    api.post('/messages/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

export const workspaceApi = {
  getMyWorkspaces: () => api.get('/workspaces/my'),
  getById: (id) => api.get(`/workspaces/${id}`),
  create: (data) => api.post('/workspaces', data),
  joinByCode: (data) => api.post('/workspaces/join-by-code', data),
  handleJoinRequest: (workspaceId, requestId, data) =>
    api.post(`/workspaces/${workspaceId}/requests/${requestId}`, data),
  inviteByEmail: (workspaceId, data) =>
    api.post(`/workspaces/${workspaceId}/invites`, data),
  getInviteByToken: (token) => api.get(`/workspaces/invite/${token}`),
  resendInvite: (workspaceId, inviteId) =>
    api.post(`/workspaces/${workspaceId}/invites/${inviteId}/resend`),
  cancelInvite: (workspaceId, inviteId) =>
    api.delete(`/workspaces/${workspaceId}/invites/${inviteId}`),
  acceptInvite: (data) => api.post('/workspaces/accept-invite', data),
  switchWorkspace: (id) => api.post(`/workspaces/${id}/switch`),
  update: (id, data) => api.put(`/workspaces/${id}`, data),
  removeMember: (workspaceId, targetUserId) =>
    api.delete(`/workspaces/${workspaceId}/members/${targetUserId}`),
};

export const notificationApi = {
  getAll: () => api.get('/notifications'),
  markAsRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.patch('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`),
};

export const contractApi = {
  getAll: (params) => api.get('/contracts', { params }),
  getSummary: (params) => api.get('/contracts/summary', { params }),
  getById: (id) => api.get(`/contracts/${id}`),
  create: (data) => api.post('/contracts', data),
  update: (id, data) => api.put(`/contracts/${id}`, data),
  updateStage: (id, stage) => api.patch(`/contracts/${id}/stage`, { stage }),
  updateMilestone: (id, milestoneId, data) =>
    api.patch(`/contracts/${id}/milestones/${milestoneId}`, data),
  delete: (id) => api.delete(`/contracts/${id}`),
  uploadAttachment: (formData) =>
    api.post('/contracts/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

export const calendarApi = {
  getTasks: (params) => api.get('/calendar/tasks', { params }),
  getContracts: (params) => api.get('/calendar/contracts', { params }),
};

export const healthApi = {
  check: () => api.get('/health'),
};

export default api;
