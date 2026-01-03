document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  loadCart();
});



// --- DELIVERY_DISTANCE_KM (optional) ---
// Pass distance in URL like: cart.html?distanceKm=3.2
function getDistanceKm() {
  try {
    const params = new URLSearchParams(window.location.search || '');
    const raw = params.get('distanceKm') ?? params.get('distance_km');
    const n = Number(raw);
    return (Number.isFinite(n) && n > 0) ? n : 0;
  } catch (e) {
    return 0;
  }
}

function getCartSummaryUrl() {
  const d = getDistanceKm();
  return d ? `${CONFIG.ENDPOINTS.CART.SUMMARY}?distanceKm=${encodeURIComponent(d)}` : CONFIG.ENDPOINTS.CART.SUMMARY;
}
// --- end DELIVERY_DISTANCE_KM ---

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
    window.location.href = 'index.html';
  }
}

async function loadCart() {
  try {
    const response = await apiRequest(CONFIG.ENDPOINTS.CART.GET);

    if (response.success) {
      displayCart(response.data);
    }
  } catch (error) {
    console.error('Failed to load cart:', error);
    showToast('Failed to load cart', 'error');
  }
}

function displayCart(cartData) {
  const cartContent = document.getElementById('cartContent');

  if (!cartData.items || cartData.items.length === 0) {
    cartContent.innerHTML = `
      <div class="empty-cart">
        <h3>Your cart is empty</h3>
        <p>Add some delicious items to your cart</p>
        <a href="index.html" class="btn btn-primary">Browse Products</a>
      </div>
    `;
    return;
  }

  let cartHTML = '<div class="cart-items">';

  cartData.items.forEach(item => {
    cartHTML += `
      <div class="cart-item">
        <div class="cart-item-image"></div>
        <div class="cart-item-details">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">₹${parseFloat(item.price).toFixed(2)}</div>
          <div class="quantity-controls">
            <button class="quantity-btn" onclick="updateQuantity(${item.id}, ${item.quantity - 1})">-</button>
            <span class="quantity">${item.quantity}</span>
            <button class="quantity-btn" onclick="updateQuantity(${item.id}, ${item.quantity + 1})">+</button>
            <button class="btn btn-danger" style="margin-left: 1rem; padding: 0.25rem 0.75rem;" onclick="removeItem(${item.id})">Remove</button>
          </div>
        </div>
        <div class="cart-item-total">
          ₹${(parseFloat(item.price) * item.quantity).toFixed(2)}
        </div>
      </div>
    `;
  });

  cartHTML += '</div>';

  cartHTML += `
    <div class="cart-summary">
      <h3>Order Summary</h3>
      <div class="summary-row">
        <span>Subtotal:</span>
        <span>₹${cartData.subtotal.toFixed(2)}</span>
      </div>
      <div class="summary-row">
        <span>Delivery Charge:</span>
        <span id="deliveryCharge">Calculating...</span>
      </div>
      <div class="summary-row summary-total">
        <span>Total:</span>
        <span id="totalAmount">Calculating...</span>
      </div>
      <div class="form-group">
        <!-- FULL_ADDRESS_FIELDS_V3_START -->
<label>Delivery Address</label>

<div class="form-group">
  <label>Full Name</label>
  <input type="text" id="custName" class="form-input" placeholder="Full name">
</div>

<div class="form-row" style="display:flex; gap:10px;">
  <div class="form-group" style="flex:1;">
    <label>House / Flat No</label>
    <input type="text" id="addrHouse" class="form-input" placeholder="House/Flat No">
  </div>
  <div class="form-group" style="flex:1;">
    <label>Street / Road</label>
    <input type="text" id="addrStreet" class="form-input" placeholder="Street/Road">
  </div>
</div>

<div class="form-group">
  <label>Area / Locality</label>
  <input type="text" id="addrArea" class="form-input" placeholder="Area / Locality">
</div>

<div class="form-group">
  <label>Landmark</label>
  <input type="text" id="addrLandmark" class="form-input" placeholder="Landmark (optional)">
</div>

<div class="form-row" style="display:flex; gap:10px;">
  <div class="form-group" style="flex:1;">
    <label>City</label>
    <input type="text" id="addrCity" class="form-input" placeholder="City">
  </div>
  <div class="form-group" style="flex:1;">
    <label>State</label>
    <input type="text" id="addrState" class="form-input" placeholder="State">
  </div>
</div>

<div class="form-group">
  <label>Pincode</label>
  <input type="text" id="addrPincode" class="form-input" placeholder="6-digit pincode" inputmode="numeric" maxlength="6">
</div>

<!-- keep legacy textarea for compatibility -->
<textarea id="deliveryAddress" class="form-input" rows="3" placeholder="Enter your delivery address" style="display:none;"></textarea>
<!-- FULL_ADDRESS_FIELDS_V3_END -->
      </div>
      <div class="form-group">
        <label>Payment Mode</label>
        <select id="paymentMode" class="form-input">
                      <option value="online">Online Payment (Razorpay)</option>
            <option value="scanner">Scanner / UPI (QR)</option>
            <option value="cod">Cash on Delivery</option>

        </select>
      </div>
      <div id="scannerBox" style="display:none; margin-top:12px; padding:12px; border:1px solid #e5e7eb; border-radius:12px;">
        <div style="font-weight:600; margin-bottom:8px;">Scanner / UPI Payment</div>
        <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
          <img id="scannerQrImg" src="" alt="Scanner QR" style="width:160px; height:160px; object-fit:contain; border:1px solid #ddd; border-radius:10px; background:#fff;">
          <div>
            <div style="margin-bottom:6px;">UPI ID: <span id="upiIdText"></span></div>
            <div id="upiMissing" style="display:none; color:#c62828; font-size:12px;">UPI ID not configured</div>
            <button type="button" class="btn btn-primary" id="btnCopyUpi" style="margin-top:8px;">Copy UPI ID</button>
            <div id="qrMissing" style="display:none; color:#c62828; font-size:12px; margin-top:8px;">QR not configured</div>
          </div>
        </div>
      </div>
      
        <!-- SCANNER_SCREENSHOT_UPLOAD_UI_V1_START -->
        <div id="scannerUploadBox" style="margin-top:12px; padding-top:12px; border-top:1px dashed #e5e7eb;">
          <div style="font-weight:600; margin-bottom:6px;">Paid Screenshot Upload</div>
          <input type="file" id="scannerScreenshot" class="form-input" accept="image/*,application/pdf">
          <input type="text" id="scannerTxId" class="form-input" placeholder="Transaction ID (optional)" style="margin-top:8px;">
          <button type="button" class="btn btn-primary" id="btnUploadScanner" style="margin-top:8px;">Upload Screenshot</button>
          <div id="scannerUploadMsg" style="font-size:12px; margin-top:6px;"></div>
          <div style="font-size:12px; color:#666; margin-top:6px;">Note: Place order first, then upload screenshot.</div>
        </div>
        <!-- SCANNER_SCREENSHOT_UPLOAD_UI_V1_END -->

        <button class="btn btn-primary btn-block" onclick="checkout()">Proceed to Checkout</button>
    </div>
  `;

  cartContent.innerHTML = cartHTML;

  loadCartSummary();
    initScannerPaymentUI();
      bindScannerUploadUI();
}

async function loadCartSummary() {
  try {
    const response = await apiRequest(getCartSummaryUrl());

    if (response.success) {
      const data = response.data;
      document.getElementById('deliveryCharge').textContent = `₹${data.deliveryCharge.toFixed(2)}`;
      document.getElementById('totalAmount').textContent = `₹${data.total.toFixed(2)}`;
    }

  } catch (error) {
    console.error('Failed to load cart summary:', error);
  }
}


  // --- SCANNER_UPI_UI (from /api/public/ui-config) ---
  let CART_SCANNER_QR = '';
  let CART_UPI_ID = '';


    // --- SCANNER_SCREENSHOT_UPLOAD_V1 ---
    let LAST_SCANNER_ORDER_ID = null;

    function getUserTokenSafe() {
      try { if (typeof getAuthToken === 'function') return getAuthToken() || ''; } catch (e) {}
      try { return localStorage.getItem('token') || localStorage.getItem('userToken') || localStorage.getItem('authToken') || ''; } catch (e) {}
      return '';
    }

    function setScannerUploadMsg(text, isError) {
      const el = document.getElementById('scannerUploadMsg');
      if (!el) return;
      el.style.color = isError ? '#c62828' : '#2e7d32';
      el.textContent = text || '';
    }

    function bindScannerUploadUI() {
      const b = document.getElementById('btnUploadScanner');
      if (!b || b.dataset.bound === '1') return;
      b.dataset.bound = '1';
      b.addEventListener('click', uploadScannerScreenshot);
    }

    async function uploadScannerScreenshot() {
      const token = getUserTokenSafe();
      if (!token) return showToast('Please login again', 'error');

      if (!LAST_SCANNER_ORDER_ID) {
        setScannerUploadMsg('Place order first, then upload screenshot.', true);
        return showToast('Place order first', 'warning');
      }

      const file = document.getElementById('scannerScreenshot')?.files?.[0];
      if (!file) {
        setScannerUploadMsg('Select screenshot/PDF first', true);
        return showToast('Select screenshot/PDF first', 'warning');
      }

      const transactionId = (document.getElementById('scannerTxId')?.value || '').trim();

      const fd = new FormData();
      fd.append('screenshot', file);
      fd.append('paymentMethod', 'scanner');
      if (CART_UPI_ID) fd.append('upiId', CART_UPI_ID);
      if (transactionId) fd.append('transactionId', transactionId);

      setScannerUploadMsg('Uploading...', false);

      try {
        const resp = await fetch(`/api/orders/${LAST_SCANNER_ORDER_ID}/upload-screenshot`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: fd
        });
        const json = await resp.json().catch(() => null);

        if (!resp.ok || !json || !json.success) {
          const m = (json && json.message) ? json.message : 'Upload failed';
          setScannerUploadMsg(m, true);
          return showToast(m, 'error');
        }

        setScannerUploadMsg('Uploaded. Verification pending.', false);
        showToast('Screenshot uploaded. Verification pending.', 'success');
        setTimeout(() => { window.location.href = `orders.html`; }, 800);
      } catch (e) {
        setScannerUploadMsg('Upload failed', true);
        showToast('Upload failed', 'error');
      }
    }
    // --- end SCANNER_SCREENSHOT_UPLOAD_V1 ---

  function toggleScannerBox() {
    const mode = document.getElementById('paymentMode')?.value;
    const box = document.getElementById('scannerBox');
    if (!box) return;
    box.style.display = (mode === 'scanner') ? 'block' : 'none';
  }

  async function loadCartUiConfig() {
    try {
      const resp = await fetch('/api/public/ui-config');
      const json = await resp.json();
      if (!resp.ok || !json || !json.success) return;

      const cfg = (json && json.data) ? json.data : {};
      CART_SCANNER_QR = cfg.scanner_qr || '';
      CART_UPI_ID = cfg.upi_id || '';

      const img = document.getElementById('scannerQrImg');
      const qrMissing = document.getElementById('qrMissing'); // FIX: correct id
      if (img && qrMissing) {
        if (CART_SCANNER_QR) {
          img.src = CART_SCANNER_QR;
          img.style.display = 'block';
          qrMissing.style.display = 'none';
        } else {
          img.style.display = 'none';
          qrMissing.style.display = 'block';
        }
      }

      const upiText = document.getElementById('upiIdText');
      const upiMissing = document.getElementById('upiMissing');
      if (upiText && upiMissing) {
        if (CART_UPI_ID) {
          upiText.textContent = CART_UPI_ID;
          upiMissing.style.display = 'none';
        } else {
          upiText.textContent = '';
          upiMissing.style.display = 'block';
        }
      }
    } catch (e) {}
  }

  function initScannerPaymentUI() {
    const sel = document.getElementById('paymentMode');
    if (sel && !sel.dataset.scannerBound) {
      sel.dataset.scannerBound = '1';
      sel.addEventListener('change', toggleScannerBox);
    }
    toggleScannerBox();
    loadCartUiConfig();

    const copyBtn = document.getElementById('btnCopyUpi');
    if (copyBtn && !copyBtn.dataset.bound) {
      copyBtn.dataset.bound = '1';
      copyBtn.addEventListener('click', async () => {
        if (!CART_UPI_ID) return showToast('UPI ID not configured', 'error');
        try {
          await navigator.clipboard.writeText(CART_UPI_ID);
          showToast('UPI ID copied', 'success');
        } catch (e) {
          showToast('Copy failed', 'error');
        }
      });
    }
  }
  // --- end SCANNER_UPI_UI ---

async function updateQuantity(cartId, newQuantity) {
  if (newQuantity < 1) return;

  try {
    await apiRequest(CONFIG.ENDPOINTS.CART.UPDATE(cartId), {
      method: 'PUT',
      body: JSON.stringify({ quantity: newQuantity })
    });

    loadCart();
  } catch (error) {
    showToast(error.message || 'Failed to update quantity', 'error');
  }
}

async function removeItem(cartId) {
  if (!confirm('Remove this item from cart?')) return;

  try {
    await apiRequest(CONFIG.ENDPOINTS.CART.REMOVE(cartId), {
      method: 'DELETE'
    });

    showToast('Item removed from cart', 'success');
    loadCart();
  } catch (error) {
    showToast(error.message || 'Failed to remove item', 'error');
  }
}

async function checkout() {
  // --- FULL_ADDRESS_HELPERS_V3 ---
function getAddrValV3(id) {
  var el = document.getElementById(id);
  return (el && typeof el.value === 'string') ? el.value.trim() : '';
}
function buildDeliveryAddressV3() {
  var name = getAddrValV3('custName');
  var house = getAddrValV3('addrHouse');
  var street = getAddrValV3('addrStreet');
  var area = getAddrValV3('addrArea');
  var landmark = getAddrValV3('addrLandmark');
  var city = getAddrValV3('addrCity');
  var state = getAddrValV3('addrState');
  var pincode = getAddrValV3('addrPincode');

  var parts = [];
  if (name) parts.push(name);
  var l1 = [house, street].filter(Boolean).join(', ');
  if (l1) parts.push(l1);
  var l2 = [area, landmark].filter(Boolean).join(', ');
  if (l2) parts.push(l2);
  var l3 = [city, state].filter(Boolean).join(', ');
  if (l3) parts.push(l3);

  var addr = parts.join(', ');
  if (pincode) addr = addr ? (addr + ' - ' + pincode) : pincode;

  var legacy = document.getElementById('deliveryAddress');
  if (legacy) legacy.value = addr;

  return { name: name, pincode: pincode, address: addr };
}
// --- end FULL_ADDRESS_HELPERS_V3 ---

const daddr = buildDeliveryAddressV3();
  const name = daddr.name;
  const pincode = daddr.pincode;
  const address = daddr.address;
  const paymentMode = document.getElementById('paymentMode').value;

  if (!name) {
    showToast('Please enter your name', 'warning');
    return;
  }

  if (!pincode || !/^[0-9]{6}$/.test(pincode)) {
    showToast('Please enter valid pincode', 'warning');
    return;
  }

  if (!address) {
    showToast('Please enter delivery address', 'warning');
    return;
  }

  try {
    const response = await apiRequest(CONFIG.ENDPOINTS.ORDERS.CREATE, {
      method: 'POST',
      body: JSON.stringify({
        deliveryAddress: address,
        paymentMode
      ,
          distanceKm: getDistanceKm()
        })
    });

    if (response.success) {
      const { orderId, paymentRequired, paymentDetails } = response.data;

      if (paymentRequired && paymentDetails) {
        initiateRazorpayPayment(orderId, paymentDetails);
      } else {
        if (String(paymentMode).toLowerCase() === 'scanner') {
          LAST_SCANNER_ORDER_ID = orderId;
          setScannerUploadMsg(`Order #${orderId} created. Upload screenshot now.`, false);
          bindScannerUploadUI();
          showToast('Order placed. Upload screenshot now.', 'success');
          return;
        }
        showToast('Order placed successfully!', 'success');
        setTimeout(() => {
          window.location.href = `orders.html`;
        }, 1500);
      }
    }
  } catch (error) {
    showToast(error.message || 'Failed to create order', 'error');
  }
}

function initiateRazorpayPayment(orderId, paymentDetails) {
  const options = {
    key: paymentDetails.keyId,
    amount: paymentDetails.amount,
    currency: paymentDetails.currency,
    name: 'FoodZone',
    description: `Order #${orderId}`,
    order_id: paymentDetails.orderId,
    handler: function(response) {
      verifyPayment(orderId, response);
    },
    prefill: {
      name: getUserData()?.name || '',
      contact: getUserData()?.phone || ''
    },
    theme: {
      color: '#2563eb'
    }
  };

  if (typeof Razorpay !== 'undefined') {
    const rzp = new Razorpay(options);
    rzp.on('payment.failed', function(response) {
      showToast('Payment failed. Please try again.', 'error');
    });
    rzp.open();
  } else {
    showToast('Payment gateway not loaded. Please refresh and try again.', 'error');
  }
}

async function verifyPayment(orderId, paymentResponse) {
  try {
    const response = await apiRequest(CONFIG.ENDPOINTS.ORDERS.VERIFY_PAYMENT(orderId), {
      method: 'POST',
      body: JSON.stringify(paymentResponse)
    });

    if (response.success) {
      showToast('Payment successful! Order confirmed.', 'success');
      setTimeout(() => {
        window.location.href = `orders.html`;
      }, 1500);
    } else {
      showToast('Payment verification failed', 'error');
    }
  } catch (error) {
    showToast(error.message || 'Payment verification failed', 'error');
  }
}
