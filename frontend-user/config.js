const API_BASE_URL = '/api';

const CONFIG = {
  API_BASE_URL,
  ENDPOINTS: {
    AUTH: {
      LOGIN_OTP: `${API_BASE_URL}/auth/user/login-otp-email`,
      VERIFY_OTP: `${API_BASE_URL}/auth/user/verify-otp`,
      REGISTER: `${API_BASE_URL}/auth/user/register`,
      LOGIN: `${API_BASE_URL}/auth/user/login`
    },
    PRODUCTS: {
      LIST: `${API_BASE_URL}/products`,
      DETAIL: (id) => `${API_BASE_URL}/products/${id}`,
      CATEGORIES: `${API_BASE_URL}/categories`,
      VENDORS: `${API_BASE_URL}/vendors`,
      VENDOR_DETAIL: (id) => `${API_BASE_URL}/vendors/${id}`
    },
    CART: {
      GET: `${API_BASE_URL}/cart`,
      ADD: `${API_BASE_URL}/cart/add`,
      UPDATE: (id) => `${API_BASE_URL}/cart/${id}`,
      REMOVE: (id) => `${API_BASE_URL}/cart/${id}`,
      CLEAR: `${API_BASE_URL}/cart`,
      SUMMARY: `${API_BASE_URL}/cart/summary`
    },
    ORDERS: {
      CREATE: `${API_BASE_URL}/orders`,
      LIST: `${API_BASE_URL}/orders`,
      DETAIL: (id) => `${API_BASE_URL}/orders/${id}`,
      VERIFY_PAYMENT: (id) => `${API_BASE_URL}/orders/${id}/verify-payment`,
      CANCEL: (id) => `${API_BASE_URL}/orders/${id}/cancel`
    }
  }
};

const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

const setAuthToken = (token) => {
  localStorage.setItem('authToken', token);
};

const clearAuthToken = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userData');
};

const getUserData = () => {
  const data = localStorage.getItem('userData');
  return data ? JSON.parse(data) : null;
};

const setUserData = (data) => {
  localStorage.setItem('userData', JSON.stringify(data));
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
    const response = await fetch(url, {
      ...options,
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return data;
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
};

const showToast = (message, type = 'info') => {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 100);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};
