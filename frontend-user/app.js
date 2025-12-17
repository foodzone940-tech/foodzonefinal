let currentUserId = null;

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  checkAuth();
  loadCategories();
  loadVendors();
  loadProducts();
  updateCartBadge();
});

function initApp() {
  const authBtn = document.getElementById('authBtn');
  const authModal = document.getElementById('authModal');
  const modalClose = document.querySelector('.modal-close');
  const sendOtpBtn = document.getElementById('sendOtpBtn');
  const verifyOtpBtn = document.getElementById('verifyOtpBtn');

  authBtn.addEventListener('click', () => {
    const token = getAuthToken();
    if (token) {
      logout();
    } else {
      authModal.classList.add('show');
    }
  });

  modalClose.addEventListener('click', () => {
    authModal.classList.remove('show');
  });

  window.addEventListener('click', (e) => {
    if (e.target === authModal) {
      authModal.classList.remove('show');
    }
  });

  sendOtpBtn.addEventListener('click', sendOTP);
  verifyOtpBtn.addEventListener('click', verifyOTP);

  document.getElementById('searchBtn').addEventListener('click', searchProducts);
  document.getElementById('searchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchProducts();
  });
}

function checkAuth() {
  const token = getAuthToken();
  const userData = getUserData();
  const authBtn = document.getElementById('authBtn');

  if (token && userData) {
    authBtn.textContent = userData.name || 'Account';
    authBtn.classList.add('btn-secondary');
    authBtn.classList.remove('btn-primary');
  } else {
    authBtn.textContent = 'Login';
    authBtn.classList.add('btn-primary');
    authBtn.classList.remove('btn-secondary');
  }
}

async function sendOTP() {
  const phone = document.getElementById('loginPhone').value.trim();

  if (!/^[0-9]{10}$/.test(phone)) {
    showToast('Please enter a valid 10-digit phone number', 'error');
    return;
  }

  try {
    document.getElementById('sendOtpBtn').disabled = true;
    document.getElementById('sendOtpBtn').textContent = 'Sending...';

    const response = await apiRequest(CONFIG.ENDPOINTS.AUTH.LOGIN_OTP, {
      method: 'POST',
      body: JSON.stringify({ phone })
    });

    if (response.success) {
      currentUserId = response.data.userId;
      document.getElementById('otpSection').classList.remove('hidden');
      showToast('OTP sent successfully!', 'success');
    }
  } catch (error) {
    showToast(error.message || 'Failed to send OTP', 'error');
  } finally {
    document.getElementById('sendOtpBtn').disabled = false;
    document.getElementById('sendOtpBtn').textContent = 'Send OTP';
  }
}

async function verifyOTP() {
  const otp = document.getElementById('otpInput').value.trim();

  if (!/^[0-9]{6}$/.test(otp)) {
    showToast('Please enter a valid 6-digit OTP', 'error');
    return;
  }

  try {
    document.getElementById('verifyOtpBtn').disabled = true;
    document.getElementById('verifyOtpBtn').textContent = 'Verifying...';

    const response = await apiRequest(CONFIG.ENDPOINTS.AUTH.VERIFY_OTP, {
      method: 'POST',
      body: JSON.stringify({
        userId: currentUserId,
        otp
      })
    });

    if (response.success) {
      setAuthToken(response.data.token);
      setUserData(response.data.user);
      showToast('Login successful!', 'success');
      document.getElementById('authModal').classList.remove('show');
      checkAuth();
      document.getElementById('loginPhone').value = '';
      document.getElementById('otpInput').value = '';
      document.getElementById('otpSection').classList.add('hidden');
    }
  } catch (error) {
    showToast(error.message || 'Invalid OTP', 'error');
  } finally {
    document.getElementById('verifyOtpBtn').disabled = false;
    document.getElementById('verifyOtpBtn').textContent = 'Verify & Login';
  }
}

function logout() {
  clearAuthToken();
  checkAuth();
  showToast('Logged out successfully', 'success');
  updateCartBadge();
}

async function loadCategories() {
  try {
    const response = await apiRequest(CONFIG.ENDPOINTS.PRODUCTS.CATEGORIES);

    const categoriesList = document.getElementById('categoriesList');
    categoriesList.innerHTML = '';

    if (response.success && response.data.length > 0) {
      response.data.forEach(category => {
        const categoryCard = document.createElement('div');
        categoryCard.className = 'category-card';
        categoryCard.innerHTML = `
          <div class="category-icon">🍽️</div>
          <h4>${category.name}</h4>
        `;
        categoryCard.addEventListener('click', () => filterByCategory(category.id));
        categoriesList.appendChild(categoryCard);
      });
    } else {
      categoriesList.innerHTML = '<p>No categories available</p>';
    }
  } catch (error) {
    console.error('Failed to load categories:', error);
    document.getElementById('categoriesList').innerHTML = '<p>Failed to load categories</p>';
  }
}

async function loadVendors() {
  try {
    const response = await apiRequest(CONFIG.ENDPOINTS.PRODUCTS.VENDORS);

    const vendorsList = document.getElementById('vendorsList');
    vendorsList.innerHTML = '';

    if (response.success && response.data.length > 0) {
      response.data.forEach(vendor => {
        const vendorCard = document.createElement('div');
        vendorCard.className = 'vendor-card';
        vendorCard.innerHTML = `
          <div class="vendor-image" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);"></div>
          <div class="vendor-info">
            <h4 class="vendor-name">${vendor.vendor_name}</h4>
            <p class="vendor-meta">${vendor.productCount || 0} items</p>
            <p class="vendor-meta">${vendor.address || 'Location not specified'}</p>
          </div>
        `;
        vendorCard.addEventListener('click', () => {
          window.location.href = `vendor.html?id=${vendor.id}`;
        });
        vendorsList.appendChild(vendorCard);
      });
    } else {
      vendorsList.innerHTML = '<p>No vendors available</p>';
    }
  } catch (error) {
    console.error('Failed to load vendors:', error);
    document.getElementById('vendorsList').innerHTML = '<p>Failed to load vendors</p>';
  }
}

async function loadProducts(filters = {}) {
  try {
    const queryParams = new URLSearchParams(filters).toString();
    const url = `${CONFIG.ENDPOINTS.PRODUCTS.LIST}?${queryParams}`;
    const response = await apiRequest(url);

    const productsList = document.getElementById('productsList');
    productsList.innerHTML = '';

    if (response.success && response.data.length > 0) {
      response.data.forEach(product => {
        const productCard = createProductCard(product);
        productsList.appendChild(productCard);
      });
    } else {
      productsList.innerHTML = '<p>No products available</p>';
    }
  } catch (error) {
    console.error('Failed to load products:', error);
    document.getElementById('productsList').innerHTML = '<p>Failed to load products</p>';
  }
}

function createProductCard(product) {
  const card = document.createElement('div');
  card.className = 'product-card';

  card.innerHTML = `
    <div class="product-image" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);"></div>
    <div class="product-info">
      <h4 class="product-name">${product.name}</h4>
      <p class="product-description">${product.description || 'Delicious food item'}</p>
      <div class="product-footer">
        <span class="product-price">₹${parseFloat(product.price).toFixed(2)}</span>
        <button class="add-to-cart-btn" data-product-id="${product.id}">Add to Cart</button>
      </div>
    </div>
  `;

  card.querySelector('.product-image').addEventListener('click', () => {
    window.location.href = `product.html?id=${product.id}`;
  });

  card.querySelector('.product-name').addEventListener('click', () => {
    window.location.href = `product.html?id=${product.id}`;
  });

  card.querySelector('.add-to-cart-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    addToCart(product.id);
  });

  return card;
}

async function addToCart(productId) {
  const token = getAuthToken();

  if (!token) {
    showToast('Please login to add items to cart', 'warning');
    document.getElementById('authModal').classList.add('show');
    return;
  }

  try {
    const response = await apiRequest(CONFIG.ENDPOINTS.CART.ADD, {
      method: 'POST',
      body: JSON.stringify({ productId, quantity: 1 })
    });

    if (response.success) {
      showToast('Item added to cart!', 'success');
      updateCartBadge();
    }
  } catch (error) {
    showToast(error.message || 'Failed to add item to cart', 'error');
  }
}

async function updateCartBadge() {
  const token = getAuthToken();

  if (!token) {
    document.getElementById('cartBadge').textContent = '0';
    return;
  }

  try {
    const response = await apiRequest(CONFIG.ENDPOINTS.CART.GET);

    if (response.success) {
      const totalItems = response.data.totalItems || 0;
      document.getElementById('cartBadge').textContent = totalItems;
    }
  } catch (error) {
    console.error('Failed to update cart badge:', error);
  }
}

function filterByCategory(categoryId) {
  loadProducts({ category_id: categoryId });
}

function searchProducts() {
  const search = document.getElementById('searchInput').value.trim();
  if (search) {
    loadProducts({ search });
  } else {
    loadProducts();
  }
}
