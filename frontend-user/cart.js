document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  loadCart();
});

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
        <label>Delivery Address</label>
        <textarea id="deliveryAddress" class="form-input" rows="3" placeholder="Enter your delivery address"></textarea>
      </div>
      <div class="form-group">
        <label>Payment Mode</label>
        <select id="paymentMode" class="form-input">
          <option value="online">Online Payment (Razorpay)</option>
          <option value="cod">Cash on Delivery</option>
        </select>
      </div>
      <button class="btn btn-primary btn-block" onclick="checkout()">Proceed to Checkout</button>
    </div>
  `;

  cartContent.innerHTML = cartHTML;

  loadCartSummary();
}

async function loadCartSummary() {
  try {
    const response = await apiRequest(CONFIG.ENDPOINTS.CART.SUMMARY);

    if (response.success) {
      const data = response.data;
      document.getElementById('deliveryCharge').textContent = `₹${data.deliveryCharge.toFixed(2)}`;
      document.getElementById('totalAmount').textContent = `₹${data.total.toFixed(2)}`;
    }
  } catch (error) {
    console.error('Failed to load cart summary:', error);
  }
}

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
  const address = document.getElementById('deliveryAddress').value.trim();
  const paymentMode = document.getElementById('paymentMode').value;

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
      })
    });

    if (response.success) {
      const { orderId, paymentRequired, paymentDetails } = response.data;

      if (paymentRequired && paymentDetails) {
        initiateRazorpayPayment(orderId, paymentDetails);
      } else {
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
