let currentVendorId = null;
let currentPage = 'dashboard';

document.addEventListener('DOMContentLoaded', () => {
  let VENDOR_PRODUCTS_CACHE = [];
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

function maskEmail(email) {
  const parts = String(email || '').split('@');
  if (parts.length !== 2) return email;
  const name = parts[0] || '';
  const domain = parts[1] || '';
  const keep = name.slice(0, 2);
  return `${keep}***@${domain}`;
}


async function sendOTP() {
  const email = document.getElementById('vendorEmail').value.trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('Please enter a valid email address', 'error');
    return;
  }

  try {
    const btn = document.getElementById('sendOtpBtn');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    const response = await apiRequest(CONFIG.ENDPOINTS.AUTH.LOGIN_OTP, {
      method: 'POST',
      body: JSON.stringify({ email })
    });

    if (response.success) {
      currentVendorId = response.data.vendorId;
      document.getElementById('otpSection').classList.remove('hidden');
      const masked = maskEmail(email);
      showToast(`OTP sent to ${masked}. Please check Inbox / Spam / Promotions.`, 'success');
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
    'earnings': 'Earnings',
      'profile': 'Profile',
      'bank': 'Bank Details'
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

  let html = '<div class="table"><table><thead><tr><th>Order ID</th><th>Customer</th><th>Items</th><th>Amount</th><th>Status</th><th>Payment Mode</th><th>Payment Status</th><th>Screenshot</th><th>Actions</th></tr></thead><tbody>';

  orders.forEach(order => {
    html += `
      <tr>
        <td>#${order.id}</td>
        <td>${order.customer_name}<br><small>${order.customer_phone}</small></td>
        <td>${order.items.length} items</td>
        <td>₹${parseFloat(order.total_amount).toFixed(2)}</td>
        <td><span class="badge badge-${order.order_status.toLowerCase()}">${order.order_status}</span></td>
          <td>${String(order.payment_mode || '-')}</td>
          <td>${String(order.payment_status || '-')}</td>
          <td>${order.payment_screenshot ? '<a href="' + order.payment_screenshot + '" target="_blank" rel="noopener"><img src="' + order.payment_screenshot + '" style="height:40px; border-radius:6px;" /></a>' : '-'}</td>
        <td>
          ${order.order_status === 'PLACED' ? `<button class="btn btn-success" onclick="updateOrderStatus(${order.id}, 'ACCEPTED')">Accept</button>` : ''}
          ${order.order_status === 'ACCEPTED' ? `<button class="btn btn-primary" onclick="updateOrderStatus(${order.id}, 'PREPARING')">Preparing</button>` : ''}
          ${order.order_status === 'PREPARING' ? `<button class="btn btn-primary" onclick="updateOrderStatus(${order.id}, 'DISPATCHED')">Dispatched</button>` : ''}
          ${order.order_status === 'DISPATCHED' ? `<button class="btn btn-success" onclick="updateOrderStatus(${order.id}, 'DELIVERED')">Delivered</button>` : ''}
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
  VENDOR_PRODUCTS_CACHE = Array.isArray(products) ? products : [];
  const content = document.getElementById('pageContent');

  let html = '<button class="btn btn-primary" onclick="showAddProductForm()" style="margin-bottom: 1rem;">Add New Product</button>';

  if (!products || products.length === 0) {
    html += '<p>No products found</p>';
    content.innerHTML = html;
    return;
  }

  html += '<div class="table"><table><thead><tr><th>Image</th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead><tbody>';

  products.forEach(product => {
    html += `
      <tr>
        <td>${product.image ? '<img src="' + product.image + '" style="width:40px;height:40px;object-fit:cover;border-radius:6px;" />' : '-'}</td>

        <td>${product.name}</td>
        <td>${product.category_name}</td>
        <td>₹${parseFloat(product.price).toFixed(2)}</td>
        <td>${product.stock_quantity}</td>
        <td><span class="badge ${product.status === 1 ? 'badge-accepted' : 'badge-cancelled'}">${product.status === 1 ? 'Active' : 'Inactive'}</span></td>
        <td>
          <button class="btn btn-primary" onclick="toggleProductStatus(${product.id}, ${product.status})">
            ${product.status === 1 ? 'Deactivate' : 'Activate'}
          </button>
            <button class="btn" onclick="showEditProductForm(${product.id})">Edit</button>
            <button class="btn btn-danger" onclick="deleteProduct(${product.id})">Delete</button>
        </td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  content.innerHTML = html;
}

function showAddProductForm() {
  const content = document.getElementById('pageContent');

  const html = `
    <div class="card" style="padding:1rem;">
      <h3 style="margin-top:0;">Add New Product</h3>

      <div class="form-group">
        <label>Name</label>
        <input id="ap_name" class="form-input" placeholder="Product name">
      </div>

      <div class="form-group">
        <label>Price</label>
        <input id="ap_price" type="number" class="form-input" placeholder="0" min="0" step="0.01">
      </div>

      <div class="form-group">
        <label>Category</label>
        <select id="ap_category" class="form-input">
          <option value="">Loading...</option>
        </select>
      </div>

      <div class="form-group">
        <label>Stock</label>
        <input id="ap_stock" type="number" class="form-input" placeholder="0" min="0" step="1">
      </div>

      <div class="form-group">
        <label>Description (optional)</label>
        <textarea id="ap_desc" class="form-input" rows="3" placeholder="Description"></textarea>
      </div>

      <div class="form-group">
        <label>Image (optional)</label>
        <input id="ap_image" type="file" accept="image/png,image/jpeg" class="form-input">
      </div>

      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
        <button id="ap_submit" class="btn btn-primary">Create Product</button>
        <button class="btn" onclick="loadProducts()">Back</button>
      </div>
    </div>
  `;

  content.innerHTML = html;

  document.getElementById('ap_submit').addEventListener('click', submitAddProduct);

  // Load categories dynamically for Add Product form
  loadCategoriesForAddProduct();
}

async function loadCategoriesForAddProduct() {
  const sel = document.getElementById('ap_category');
  if (!sel) return;

  sel.innerHTML = '<option value="">Loading...</option>';

  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/categories`);
    const data = await res.json();
    const list = (data && data.data) ? data.data : [];

    if (!Array.isArray(list) || list.length === 0) {
      sel.innerHTML = '<option value="">No categories</option>';
      return;
    }

    sel.innerHTML = list.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  } catch (e) {
    sel.innerHTML = '<option value="">Failed to load</option>';
  }
}



  function showEditProductForm(productId) {
    const content = document.getElementById('pageContent');
    const list = Array.isArray(VENDOR_PRODUCTS_CACHE) ? VENDOR_PRODUCTS_CACHE : [];
    const product = list.find(p => String(p.id) === String(productId));

    if (!product) {
      showToast('Product not found. Refresh Products.', 'error');
      return;
    }

    const html = `
      <div class="card" style="padding:1rem;">
        <h3 style="margin-top:0;">Edit Product</h3>

        <div class="form-group">
          <label>Name</label>
          <input id="ep_name" class="form-input" placeholder="Product name">
        </div>

        <div class="form-group">
          <label>Price</label>
          <input id="ep_price" type="number" class="form-input" placeholder="0" min="0" step="0.01">
        </div>

        <div class="form-group">
          <label>Category</label>
          <select id="ep_category" class="form-input">
            <option value="">Loading...</option>
          </select>
        </div>

        <div class="form-group">
          <label>Stock</label>
          <input id="ep_stock" type="number" class="form-input" placeholder="0" min="0" step="1">
        </div>

        <div class="form-group">
          <label>Description (optional)</label>
          <textarea id="ep_desc" class="form-input" rows="3" placeholder="Description"></textarea>
        </div>

        <div class="form-group">
          <label>Current Image</label>
          <div id="ep_preview" style="margin-top:6px;"></div>
        </div>

        <div class="form-group">
          <label>Replace Image (optional)</label>
          <input id="ep_image" type="file" accept="image/png,image/jpeg" class="form-input">
        </div>

        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
          <button id="ep_submit" class="btn btn-primary">Save Changes</button>
          <button class="btn" onclick="loadProducts()">Back</button>
        </div>
      </div>
    `;

    content.innerHTML = html;

    // Prefill
    document.getElementById('ep_name').value = product.name || '';
    document.getElementById('ep_price').value = product.price ?? '';
    document.getElementById('ep_stock').value = product.stock_quantity ?? '';
    document.getElementById('ep_desc').value = product.description || '';

    // Preview
    const prev = document.getElementById('ep_preview');
    prev.innerHTML = product.image
      ? `<a href="${product.image}" target="_blank" rel="noopener"><img src="${product.image}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;" /></a>`
      : '<small>No image</small>';

    // Categories + select current
    loadCategoriesForEditProduct(product.category_id || product.categoryId || product.category);

    document.getElementById('ep_submit').addEventListener('click', () => submitEditProduct(product.id));
  }

  async function loadCategoriesForEditProduct(selectedId) {
    const sel = document.getElementById('ep_category');
    if (!sel) return;

    sel.innerHTML = '<option value="">Loading...</option>';

    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/categories`);
      const data = await res.json();
      const list = (data && data.data) ? data.data : [];

      if (!Array.isArray(list) || list.length === 0) {
        sel.innerHTML = '<option value="">No categories</option>';
        return;
      }

      sel.innerHTML = list.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      if (selectedId) sel.value = String(selectedId);
    } catch (e) {
      sel.innerHTML = '<option value="">Failed to load</option>';
    }
  }

  async function submitEditProduct(productId) {
    const name = document.getElementById('ep_name').value.trim();
    const price = document.getElementById('ep_price').value.trim();
    const categoryId = document.getElementById('ep_category').value;
    const stock = document.getElementById('ep_stock').value.trim();
    const description = document.getElementById('ep_desc').value.trim();
    const imageInput = document.getElementById('ep_image');

    if (!name) return showToast('Name is required', 'error');
    if (!price || isNaN(Number(price))) return showToast('Valid price required', 'error');
    if (!categoryId) return showToast('Category required', 'error');

    const btn = document.getElementById('ep_submit');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('price', String(price));
      fd.append('categoryId', String(categoryId));
      if (description) fd.append('description', description);
      if (stock !== '') fd.append('stock', String(stock));
      if (imageInput && imageInput.files && imageInput.files[0]) fd.append('image', imageInput.files[0]);

      const token = getAuthToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(CONFIG.ENDPOINTS.VENDOR.UPDATE_PRODUCT(productId), { method: 'PUT', headers, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Update product failed');

      showToast('Product updated successfully', 'success');
      loadProducts();
    } catch (e) {
      showToast(e.message || 'Update product failed', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Changes';
    }
  }

async function submitAddProduct() {
  const name = document.getElementById('ap_name').value.trim();
  const price = document.getElementById('ap_price').value.trim();
  const categoryId = document.getElementById('ap_category').value;
  const stock = document.getElementById('ap_stock').value.trim();
  const description = document.getElementById('ap_desc').value.trim();
  const imageInput = document.getElementById('ap_image');

  if (!name) return showToast('Name is required', 'error');
  if (!price || isNaN(Number(price))) return showToast('Valid price required', 'error');
  if (!categoryId) return showToast('Category required', 'error');

  const btn = document.getElementById('ap_submit');
  btn.disabled = true;
  btn.textContent = 'Creating...';

  try {
    const fd = new FormData();
    fd.append('name', name);
    fd.append('price', String(price));
    fd.append('categoryId', String(categoryId));
    if (description) fd.append('description', description);
    if (stock !== '') fd.append('stock', String(stock));
    if (imageInput && imageInput.files && imageInput.files[0]) fd.append('image', imageInput.files[0]);

    const token = getAuthToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(CONFIG.ENDPOINTS.VENDOR.CREATE_PRODUCT, { method: 'POST', headers, body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Create product failed');

    showToast('Product created successfully', 'success');
    loadProducts();
  } catch (e) {
    showToast(e.message || 'Create product failed', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Product';
  }
}

  async function deleteProduct(productId) {
    if (!confirm('Delete this product?')) return;

    try {
      const response = await apiRequest(CONFIG.ENDPOINTS.VENDOR.DELETE_PRODUCT(productId), {
        method: 'DELETE'
      });

      if (response && response.success) {
        showToast('Product deleted', 'success');
        loadProducts();
      } else {
        showToast((response && response.message) ? response.message : 'Delete failed', 'error');
      }
    } catch (error) {
      showToast(error.message || 'Delete failed', 'error');
    }
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



async function loadProfile() {
  const content = document.getElementById('pageContent');
  const vd = (typeof getVendorData === 'function' ? (getVendorData() || {}) : {});
  const banner = vd.banner || '';
  const profilePhoto = vd.profile_photo || vd.profilePhoto || '';

  content.innerHTML = `
    <div class="card" style="padding:1rem;">
      <h3 style="margin-top:0;">Profile</h3>

      <div class="form-group">
        <label>Vendor Name</label>
        <input id="vp_name" class="form-input" placeholder="Vendor name" value="${(vd.vendor_name || vd.vendorName || '').toString().replace(/"/g,'&quot;')}">
      </div>

      <div class="form-group">
        <label>Email</label>
        <input id="vp_email" type="email" class="form-input" placeholder="Email" value="${(vd.email || '').toString().replace(/"/g,'&quot;')}">
      </div>

      <div class="form-group">
        <label>Address</label>
        <input id="vp_address" class="form-input" placeholder="Address" value="${(vd.address || '').toString().replace(/"/g,'&quot;')}">
      </div>

      <div class="form-group">
        <label>Pincode</label>
        <input id="vp_pincode" class="form-input" placeholder="Pincode" value="${(vd.pincode || '').toString().replace(/"/g,'&quot;')}">
      </div>

      <div class="form-group">
        <label>Banner Image (optional)</label>
        <input id="vp_banner" type="file" accept="image/png,image/jpeg" class="form-input">
        ${banner ? `<div style="margin-top:8px;"><img src="${banner}" style="width:120px;height:60px;object-fit:cover;border-radius:10px;" /></div>` : ''}
      </div>

      <div class="form-group">
        <label>Profile Photo (optional)</label>
        <input id="vp_photo" type="file" accept="image/png,image/jpeg" class="form-input">
        ${profilePhoto ? `<div style="margin-top:8px;"><img src="${profilePhoto}" style="width:70px;height:70px;object-fit:cover;border-radius:50%;" /></div>` : ''}
      </div>

      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
        <button id="vp_submit" class="btn btn-primary">Save Profile</button>
      </div>
    </div>
  `;

  document.getElementById('vp_submit').addEventListener('click', submitProfile);
}

async function submitProfile() {
  const vendorName = document.getElementById('vp_name').value.trim();
  const email = document.getElementById('vp_email').value.trim();
  const address = document.getElementById('vp_address').value.trim();
  const pincode = document.getElementById('vp_pincode').value.trim();
  const bannerInput = document.getElementById('vp_banner');
  const photoInput = document.getElementById('vp_photo');

  const btn = document.getElementById('vp_submit');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const fd = new FormData();
    if (vendorName) fd.append('vendorName', vendorName);
    if (email) fd.append('email', email);
    if (address) fd.append('address', address);
    if (pincode) fd.append('pincode', pincode);
    if (bannerInput && bannerInput.files && bannerInput.files[0]) fd.append('banner', bannerInput.files[0]);
    if (photoInput && photoInput.files && photoInput.files[0]) fd.append('profile_photo', photoInput.files[0]);

    const token = getAuthToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(CONFIG.ENDPOINTS.VENDOR.PROFILE, { method: 'PUT', headers, body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Profile update failed');

    // update local cached vendor data (UI only)
    const vd = getVendorData() || {};
    const merged = { ...vd };
    if (vendorName) merged.vendor_name = vendorName;
    if (email) merged.email = email;
    if (address) merged.address = address;
    if (pincode) merged.pincode = pincode;
    setVendorData(merged);

    showToast('Profile updated', 'success');
    loadProfile();
  } catch (e) {
    showToast(e.message || 'Profile update failed', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Profile';
  }
}

async function loadBankDetails() {
  const content = document.getElementById('pageContent');
  content.innerHTML = '<p>Loading bank details...</p>';

  let bank = null;
  try {
    const res = await apiRequest(CONFIG.ENDPOINTS.VENDOR.BANK_DETAILS);
    bank = (res && res.data) ? res.data : null;
  } catch (e) {
    bank = null;
  }

  content.innerHTML = `
    <div class="card" style="padding:1rem;">
      <h3 style="margin-top:0;">Bank Details</h3>

      <div class="form-group">
        <label>Account Holder</label>
        <input id="vb_holder" class="form-input" placeholder="Account holder" value="${bank?.account_holder || ''}">
      </div>

      <div class="form-group">
        <label>Account Number</label>
        <input id="vb_number" class="form-input" placeholder="Account number" value="${bank?.account_number || ''}">
      </div>

      <div class="form-group">
        <label>IFSC Code</label>
        <input id="vb_ifsc" class="form-input" placeholder="IFSC" value="${bank?.ifsc_code || ''}">
      </div>

      <div class="form-group">
        <label>Bank Name</label>
        <input id="vb_bank" class="form-input" placeholder="Bank name" value="${bank?.bank_name || ''}">
      </div>

      <div class="form-group">
        <label>Branch Name (optional)</label>
        <input id="vb_branch" class="form-input" placeholder="Branch name" value="${bank?.branch_name || ''}">
      </div>

      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
        <button id="vb_submit" class="btn btn-primary">Save Bank Details</button>
      </div>
    </div>
  `;

  document.getElementById('vb_submit').addEventListener('click', submitBankDetails);
}

async function submitBankDetails() {
  const accountHolder = document.getElementById('vb_holder').value.trim();
  const accountNumber = document.getElementById('vb_number').value.trim();
  const ifscCode = document.getElementById('vb_ifsc').value.trim();
  const bankName = document.getElementById('vb_bank').value.trim();
  const branchName = document.getElementById('vb_branch').value.trim();

  if (!accountHolder || !accountNumber || !ifscCode || !bankName) {
    return showToast('Account holder, number, IFSC, bank name required', 'error');
  }

  const btn = document.getElementById('vb_submit');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const res = await apiRequest(CONFIG.ENDPOINTS.VENDOR.BANK_DETAILS, {
      method: 'PUT',
      body: JSON.stringify({ accountHolder, accountNumber, ifscCode, bankName, branchName })
    });

    if (res && res.success) {
      showToast('Bank details saved', 'success');
      loadBankDetails();
    } else {
      showToast((res && res.message) ? res.message : 'Save failed', 'error');
    }
  } catch (e) {
    showToast(e.message || 'Save failed', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Bank Details';
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
