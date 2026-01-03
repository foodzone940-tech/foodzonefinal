let currentUserId = null;
let PRODUCT_PLACEHOLDER_IMG = '';
let VENDOR_DEFAULT_LOGO = '';

async function loadUiConfig() {
  try {
    const resp = await fetch('/api/public/ui-config');
    const json = await resp.json();
    if (!resp.ok || !json || !json.success) return;

    const cfg = (json.data && json.data.config) ? json.data.config : {};
    PRODUCT_PLACEHOLDER_IMG = cfg.product_placeholder_image || '';
    VENDOR_DEFAULT_LOGO = cfg.vendor_default_logo || '';

    const banners = (json.data && json.data.banners) ? json.data.banners : [];

      // Global delivery settings (camelCase) for all pages
      window.FZ_DELIVERY_SETTINGS = (json.data && json.data.deliverySettings) ? json.data.deliverySettings : null;


    // Header logo
    // Favicon
    if (cfg.site_favicon) {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = cfg.site_favicon;
    }

    // Site App Icon (fallback logo image if site_logo missing)
    if (!cfg.site_logo && cfg.site_app_icon) {
      const logoDiv = document.querySelector('.logo');
      if (logoDiv) logoDiv.innerHTML = `<img src="${cfg.site_app_icon}" alt="FoodZone" class="site-logo-img">`;

      const footerLogo = document.querySelector('.footer-logo');
      if (footerLogo) footerLogo.innerHTML = `<img src="${cfg.site_app_icon}" alt="FoodZone" class="footer-logo-img">`;
    }

    if (cfg.site_logo) {
      const logoDiv = document.querySelector('.logo');
      if (logoDiv) logoDiv.innerHTML = `<img src="${cfg.site_logo}" alt="FoodZone" class="site-logo-img">`;

      const footerLogo = document.querySelector('.footer-logo');
      if (footerLogo) footerLogo.innerHTML = `<img src="${cfg.site_logo}" alt="FoodZone" class="footer-logo-img">`;
    }

    // Hero banner (use latest active banner)
    if (banners.length && banners[0].image_url) {
      const hero = document.querySelector('.hero');
      if (hero) {
        hero.style.backgroundImage = `url('${banners[0].image_url}')`;
        const isDesktop = window.matchMedia('(min-width: 992px)').matches;
        hero.style.backgroundSize = 'cover';
        hero.style.backgroundPosition = 'center';
        hero.style.backgroundRepeat = 'no-repeat';
        hero.style.backgroundColor = 'var(--primary-dark)';
      }
    }
  } catch (e) {
    console.error('UI config load failed:', e);
  }
}


document.addEventListener('DOMContentLoaded', async () => {
  await loadUiConfig();
  initApp();
  checkAuth();
  updateCartBadge();

  const page = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();

  if (page === 'vendor.html') {
    loadVendorPage();
  } else if (page === 'product.html') {
    loadProductPage();
  } else {
    loadCategories();
    loadVendors();
    loadProducts();
  }
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
  const email = document.getElementById('loginEmail').value.trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('Please enter a valid email address', 'error');
    return;
  }

  try {
    document.getElementById('sendOtpBtn').disabled = true;
    document.getElementById('sendOtpBtn').textContent = 'Sending...';

    const response = await apiRequest(CONFIG.ENDPOINTS.AUTH.LOGIN_OTP, {
      method: 'POST',
      body: JSON.stringify({ email })
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
      document.getElementById('loginEmail').value = '';
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

        const vimg = vendor.image || VENDOR_DEFAULT_LOGO;
        if (vimg) {
          const vEl = vendorCard.querySelector('.vendor-image');
          if (vEl) {
            vEl.style.backgroundImage = `url('${vimg}')`;
            vEl.style.backgroundSize = 'cover';
            vEl.style.backgroundPosition = 'center';
          }
        }

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


function getPageId() {
  return new URLSearchParams(window.location.search).get('id');
}

async function loadVendorPage() {
  const vendorId = getPageId();
  if (!vendorId) {
    showToast('Vendor not found', 'error');
    return;
  }

  try {
    const response = await apiRequest(`${CONFIG.ENDPOINTS.PRODUCTS.VENDORS}/${vendorId}`);
    const vendorsList = document.getElementById('vendorsList');
    const productsList = document.getElementById('productsList');

    if (!response.success || !response.data) {
      if (vendorsList) vendorsList.innerHTML = '<p>Vendor not found</p>';
      if (productsList) productsList.innerHTML = '<p>No products available</p>';
      return;
    }

    const v = response.data;

    const heroTitle = document.querySelector('.hero-title');
    const heroSub = document.querySelector('.hero-subtitle');
    if (heroTitle) heroTitle.textContent = v.vendor_name || 'Vendor';
    if (heroSub) heroSub.textContent = v.address || 'Location not specified';

    if (vendorsList) {
      vendorsList.innerHTML = '';
      const vendorCard = document.createElement('div');
      vendorCard.className = 'vendor-card';
      vendorCard.innerHTML = `
        <div class="vendor-image" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);"></div>
        <div class="vendor-info">
          <h4 class="vendor-name">${v.vendor_name || ''}</h4>
          <p class="vendor-meta">${(v.products || []).length} items</p>
          <p class="vendor-meta">${v.address || 'Location not specified'}</p>
        </div>
      `;

      const vimg = v.image || VENDOR_DEFAULT_LOGO;
      if (vimg) {
        const vEl = vendorCard.querySelector('.vendor-image');
        if (vEl) {
          vEl.style.backgroundImage = `url('${vimg}')`;
          vEl.style.backgroundSize = 'cover';
          vEl.style.backgroundPosition = 'center';
        }
      }

      vendorsList.appendChild(vendorCard);
    }

    if (productsList) {
      productsList.innerHTML = '';
      const items = v.products || [];
      if (items.length > 0) {
        items.forEach(product => productsList.appendChild(createProductCard(product)));
      } else {
        productsList.innerHTML = '<p>No products available</p>';
      }
    }
  } catch (error) {
    console.error('Failed to load vendor page:', error);
    const vendorsList = document.getElementById('vendorsList');
    const productsList = document.getElementById('productsList');
    if (vendorsList) vendorsList.innerHTML = '<p>Failed to load vendor</p>';
    if (productsList) productsList.innerHTML = '<p>Failed to load products</p>';
  }
}

async function loadProductPage() {
  const productId = getPageId();
  if (!productId) {
    showToast('Product not found', 'error');
    return;
  }

  try {
    const response = await apiRequest(`${CONFIG.ENDPOINTS.PRODUCTS.LIST}/${productId}`);
    const vendorsList = document.getElementById('vendorsList');
    const productsList = document.getElementById('productsList');

    if (!response.success || !response.data) {
      if (productsList) productsList.innerHTML = '<p>Product not found</p>';
      return;
    }

    const p = response.data;

    const heroTitle = document.querySelector('.hero-title');
    const heroSub = document.querySelector('.hero-subtitle');
    if (heroTitle) heroTitle.textContent = p.name || 'Product';
    if (heroSub) heroSub.textContent = p.vendor_name ? `Sold by ${p.vendor_name}` : (p.category_name || '');

    if (vendorsList && p.vendor_id) {
      vendorsList.innerHTML = `<p style="margin:0;">Sold by <a href="vendor.html?id=${p.vendor_id}">${p.vendor_name || 'Vendor'}</a></p>`;
    }

    if (productsList) {
      productsList.innerHTML = '';
      productsList.appendChild(createProductCard(p));
    }
  } catch (error) {
    console.error('Failed to load product page:', error);
    const productsList = document.getElementById('productsList');
    if (productsList) productsList.innerHTML = '<p>Failed to load product</p>';
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

    const pimg = product.image || PRODUCT_PLACEHOLDER_IMG;
    if (pimg) {
      const pEl = card.querySelector('.product-image');
      if (pEl) {
        pEl.style.backgroundImage = `url('${pimg}')`;
        pEl.style.backgroundSize = 'cover';
        pEl.style.backgroundPosition = 'center';
      }
    }


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
