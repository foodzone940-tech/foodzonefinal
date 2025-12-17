let currentVendorId = null;
let currentPage = 'dashboard';

document.addEventListener('DOMContentLoaded', () => {
  const token = getAuthToken();

  if (token) {
    initDashboard();
  } else {
    showLoginModal();
  }
});

function showLoginModal() {
  const loginModal = document.getElementById('loginModal');
  loginModal.classList.add('show');

  document.getElementById('sendOtpBtn').addEventListener('click', sendOTP);
  document.getElementById('verifyOtpBtn').addEventListener('click', verifyOTP);
}

async function sendOTP() {
  const phone = document.getElementById('vendorPhone').value.trim();

  if (!/^[0-9]{10}$/.test(phone)) {
    showToast('Please enter a valid 10-digit phone number', 'error');
    return;
  }

  try {
    const btn = document.getElementById('sendOtpBtn');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    const response = await apiRequest(CONFIG.ENDPOINTS.AUTH.LOGIN_OTP, {
      method: 'POST',
      body: JSON.stringify({ phone })
    });

    if (response.success) {
      currentVendorId = response.data.vendorId;
      document.getElementById('otpSection').classList.remove('hidden');
      showToast('OTP sent successfully!', 'success');
    }
  } catch (error) {
    showToast(error.message || 'Failed to send OTP', 'error');
  } finally {
    const btn = document.getElementById('sendOtpBtn');
    btn.disabled = false;
    btn.textContent = 'Send OTP';
  }
}

async function verifyOTP() {
  const otp = document.getElementById('otpInput').value.trim();

  if (!/^[0-9]{6}$/.test(otp)) {
    showToast('Please enter a valid 6-digit OTP', 'error');
    return;
  }

  try {
    const btn = document.getElementById('verifyOtpBtn');
    btn.disabled = true;
    btn.textContent = 'Verifying...';

    const response = await apiRequest(CONFIG.ENDPOINTS.AUTH.VERIFY_OTP, {
      method: 'POST',
      body: JSON.stringify({ vendorId: currentVendorId, otp })
    });

    if (response.success) {
      setAuthToken(response.data.token);
      setVendorData(response.data.vendor);
      showToast('Login successful!', 'success');
      document.getElementById('loginModal').classList.remove('show');
      initDashboard();
    }
  } catch (error) {
    showToast(error.message || 'Invalid OTP', 'error');
  } finally {
    const btn = document.getElementById('verifyOtpBtn');
    btn.disabled = false;
    btn.textContent = 'Verify & Login';
  }
}

function initDashboard() {
  const vendorData = getVendorData();
  document.getElementById('vendorInfo').textContent = vendorData?.vendor_name || 'Vendor';

  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.getAttribute('data-page');
      loadPage(page);
    });
  });

  document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    logout();
  });

  loadPage('dashboard');
}

function loadPage(page) {
  currentPage = page;

  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');

  const pageTitle = {
    'dashboard': 'Dashboard',
    'orders': 'Orders',
    'products': 'Products',
    'earnings': 'Earnings'
  };

  document.getElementById('pageTitle').textContent = pageTitle[page] || 'Dashboard';

  switch (page) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'orders':
      loadOrders();
      break;
    case 'products':
      loadProducts();
      break;
    case 'earnings':
      loadEarnings();
      break;
  }
}

async function loadDashboard() {
  try {
    const response = await apiRequest(CONFIG.ENDPOINTS.VENDOR.DASHBOARD);

    if (response.success) {
      const data = response.data;
      document.getElementById('todayOrders').textContent = data.todayOrders;
      document.getElementById('todayRevenue').textContent = `₹${data.todayRevenue.toFixed(2)}`;
      document.getElementById('pendingOrders').textContent = data.pendingOrders;
      document.getElementById('totalProducts').textContent = data.totalProducts;
    }
  } catch (error) {
    showToast('Failed to load dashboard', 'error');
  }
}

async function loadOrders() {
  try {
    const response = await apiRequest(CONFIG.ENDPOINTS.VENDOR.ORDERS);

    if (response.success) {
      displayOrders(response.data);
    }
  } catch (error) {
    showToast('Failed to load orders', 'error');
  }
}

function displayOrders(orders) {
  const content = document.getElementById('pageContent');

  if (!orders || orders.length === 0) {
    content.innerHTML = '<p>No orders found</p>';
    return;
  }

  let html = '<div class="table"><table><thead><tr><th>Order ID</th><th>Customer</th><th>Items</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>';

  orders.forEach(order => {
    html += `
      <tr>
        <td>#${order.id}</td>
        <td>${order.customer_name}<br><small>${order.customer_phone}</small></td>
        <td>${order.items.length} items</td>
        <td>₹${parseFloat(order.total_amount).toFixed(2)}</td>
        <td><span class="badge badge-${order.order_status.toLowerCase()}">${order.order_status}</span></td>
        <td>
          ${order.order_status === 'PLACED' ? `<button class="btn btn-success" onclick="updateOrderStatus(${order.id}, 'ACCEPTED')">Accept</button>` : ''}
          ${order.order_status === 'ACCEPTED' ? `<button class="btn btn-primary" onclick="updateOrderStatus(${order.id}, 'PREPARING')">Preparing</button>` : ''}
          ${order.order_status === 'PREPARING' ? `<button class="btn btn-primary" onclick="updateOrderStatus(${order.id}, 'READY')">Ready</button>` : ''}
          ${order.order_status === 'READY' ? `<button class="btn btn-success" onclick="updateOrderStatus(${order.id}, 'DELIVERED')">Delivered</button>` : ''}
        </td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  content.innerHTML = html;
}

async function updateOrderStatus(orderId, status) {
  try {
    const response = await apiRequest(CONFIG.ENDPOINTS.VENDOR.UPDATE_ORDER_STATUS(orderId), {
      method: 'PUT',
      body: JSON.stringify({ status })
    });

    if (response.success) {
      showToast(`Order ${status.toLowerCase()}`, 'success');
      loadOrders();
    }
  } catch (error) {
    showToast(error.message || 'Failed to update order status', 'error');
  }
}

async function loadProducts() {
  try {
    const response = await apiRequest(CONFIG.ENDPOINTS.VENDOR.PRODUCTS);

    if (response.success) {
      displayProducts(response.data);
    }
  } catch (error) {
    showToast('Failed to load products', 'error');
  }
}

function displayProducts(products) {
  const content = document.getElementById('pageContent');

  let html = '<button class="btn btn-primary" onclick="showAddProductForm()" style="margin-bottom: 1rem;">Add New Product</button>';

  if (!products || products.length === 0) {
    html += '<p>No products found</p>';
    content.innerHTML = html;
    return;
  }

  html += '<div class="table"><table><thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead><tbody>';

  products.forEach(product => {
    html += `
      <tr>
        <td>${product.name}</td>
        <td>${product.category_name}</td>
        <td>₹${parseFloat(product.price).toFixed(2)}</td>
        <td>${product.stock_quantity}</td>
        <td><span class="badge ${product.status === 1 ? 'badge-accepted' : 'badge-cancelled'}">${product.status === 1 ? 'Active' : 'Inactive'}</span></td>
        <td>
          <button class="btn btn-primary" onclick="toggleProductStatus(${product.id}, ${product.status})">
            ${product.status === 1 ? 'Deactivate' : 'Activate'}
          </button>
        </td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  content.innerHTML = html;
}

function showAddProductForm() {
  showToast('Add product form - integrate with your categories API', 'info');
}

async function toggleProductStatus(productId, currentStatus) {
  const newStatus = currentStatus === 1 ? 0 : 1;

  try {
    const response = await apiRequest(CONFIG.ENDPOINTS.VENDOR.UPDATE_PRODUCT(productId), {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus })
    });

    if (response.success) {
      showToast('Product status updated', 'success');
      loadProducts();
    }
  } catch (error) {
    showToast(error.message || 'Failed to update product', 'error');
  }
}

async function loadEarnings() {
  try {
    const response = await apiRequest(CONFIG.ENDPOINTS.VENDOR.EARNINGS);

    if (response.success) {
      displayEarnings(response.data);
    }
  } catch (error) {
    showToast('Failed to load earnings', 'error');
  }
}

function displayEarnings(data) {
  const content = document.getElementById('pageContent');

  let html = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">₹${data.totalEarnings.toFixed(2)}</div>
        <div class="stat-label">Total Earnings</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">₹${data.monthlyEarnings.toFixed(2)}</div>
        <div class="stat-label">This Month</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">₹${data.pendingPayouts.toFixed(2)}</div>
        <div class="stat-label">Pending Payouts</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">₹${data.completedPayouts.toFixed(2)}</div>
        <div class="stat-label">Completed Payouts</div>
      </div>
    </div>
  `;

  if (data.recentPayouts && data.recentPayouts.length > 0) {
    html += '<h3 style="margin-top: 2rem; margin-bottom: 1rem;">Recent Payouts</h3>';
    html += '<div class="table"><table><thead><tr><th>Date</th><th>Amount</th><th>Status</th><th>Remarks</th></tr></thead><tbody>';

    data.recentPayouts.forEach(payout => {
      html += `
        <tr>
          <td>${new Date(payout.payout_date).toLocaleDateString()}</td>
          <td>₹${parseFloat(payout.payout_amount).toFixed(2)}</td>
          <td><span class="badge badge-${payout.payout_status}">${payout.payout_status}</span></td>
          <td>${payout.remarks || '-'}</td>
        </tr>
      `;
    });

    html += '</tbody></table></div>';
  }

  content.innerHTML = html;
}

function logout() {
  clearAuthToken();
  showToast('Logged out successfully', 'success');
  location.reload();
}
