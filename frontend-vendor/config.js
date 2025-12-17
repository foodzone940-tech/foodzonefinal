const API_BASE_URL = 'http://localhost:5000/api';

const CONFIG = {
  API_BASE_URL,
  ENDPOINTS: {
    AUTH: {
      LOGIN_OTP: `${API_BASE_URL}/auth/vendor/login-otp`,
      VERIFY_OTP: `${API_BASE_URL}/auth/vendor/verify-otp`
    },
    VENDOR: {
      DASHBOARD: `${API_BASE_URL}/vendor/dashboard`,
      ORDERS: `${API_BASE_URL}/vendor/orders`,
      UPDATE_ORDER_STATUS: (id) => `${API_BASE_URL}/vendor/orders/${id}/status`,
      PRODUCTS: `${API_BASE_URL}/vendor/products`,
      CREATE_PRODUCT: `${API_BASE_URL}/vendor/products`,
      UPDATE_PRODUCT: (id) => `${API_BASE_URL}/vendor/products/${id}`,
      DELETE_PRODUCT: (id) => `${API_BASE_URL}/vendor/products/${id}`,
      EARNINGS: `${API_BASE_URL}/vendor/earnings`
    }
  }
};

const getAuthToken = () => localStorage.getItem('vendorToken');
const setAuthToken = (token) => localStorage.setItem('vendorToken', token);
const clearAuthToken = () => {
  localStorage.removeItem('vendorToken');
  localStorage.removeItem('vendorData');
};

const getVendorData = () => {
  const data = localStorage.getItem('vendorData');
  return data ? JSON.parse(data) : null;
};

const setVendorData = (data) => {
  localStorage.setItem('vendorData', JSON.stringify(data));
};

const apiRequest = async (url, options = {}) => {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, { ...options, headers });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

const showToast = (message, type = 'info') => {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
};
