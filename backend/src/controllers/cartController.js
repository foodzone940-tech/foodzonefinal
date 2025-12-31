import { query, transaction } from '../config/database.js';

export const getCart = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const cartItems = await query(
      `SELECT c.*, p.name, p.price, p.image, p.vendor_id, v.vendor_name,
              COALESCE(i.quantity, 0) as stock_quantity
       FROM cart c
       JOIN products p ON c.product_id = p.id
       JOIN vendors v ON p.vendor_id = v.id
       LEFT JOIN inventory_stock i ON p.id = i.product_id
       WHERE c.user_id = ? AND p.status = 1`,
      [userId]
    );

    let subtotal = 0;
    const vendorGroups = {};

    for (const item of cartItems) {
      const itemTotal = parseFloat(item.price) * item.quantity;
      subtotal += itemTotal;

      if (!vendorGroups[item.vendor_id]) {
        vendorGroups[item.vendor_id] = {
          vendorId: item.vendor_id,
          vendorName: item.vendor_name,
          items: []
        };
      }

      vendorGroups[item.vendor_id].items.push({
        ...item,
        itemTotal
      });
    }

    res.json({
      success: true,
      data: {
        items: cartItems,
        vendorGroups: Object.values(vendorGroups),
        subtotal,
        totalItems: cartItems.length
      }
    });
  } catch (error) {
    next(error);
  }
};

export const addToCart = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { productId, quantity = 1 } = req.body;

    const [product] = await query(
      `SELECT p.*, COALESCE(i.quantity, 0) as stock_quantity
       FROM products p
       LEFT JOIN inventory_stock i ON p.id = i.product_id
       WHERE p.id = ? AND p.status = 1`,
      [productId]
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or unavailable'
      });
    }

    if (product.stock_quantity > 0 && quantity > product.stock_quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock_quantity} items available in stock`
      });
    }

    const [existingCart] = await query(
      'SELECT * FROM cart WHERE user_id = ? AND product_id = ?',
      [userId, productId]
    );

    if (existingCart) {
      const newQuantity = existingCart.quantity + quantity;

      if (product.stock_quantity > 0 && newQuantity > product.stock_quantity) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more. Only ${product.stock_quantity} items available`
        });
      }

      await query(
        'UPDATE cart SET quantity = ? WHERE id = ?',
        [newQuantity, existingCart.id]
      );
    } else {
      const cartItems = await query(
        `SELECT p.vendor_id FROM cart c
         JOIN products p ON c.product_id = p.id
         WHERE c.user_id = ?
         LIMIT 1`,
        [userId]
      );

      if (cartItems.length > 0 && cartItems[0].vendor_id !== product.vendor_id) {
        return res.status(400).json({
          success: false,
          message: 'You can only order from one vendor at a time. Please clear your cart first.'
        });
      }

      await query(
        'INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)',
        [userId, productId, quantity]
      );
    }

    res.json({
      success: true,
      message: 'Item added to cart successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const updateCartItem = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { cartId } = req.params;
    const { quantity } = req.body;

    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1'
      });
    }

    const [cartItem] = await query(
      `SELECT c.*, p.id as product_id, COALESCE(i.quantity, 0) as stock_quantity
       FROM cart c
       JOIN products p ON c.product_id = p.id
       LEFT JOIN inventory_stock i ON p.id = i.product_id
       WHERE c.id = ? AND c.user_id = ?`,
      [cartId, userId]
    );

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found'
      });
    }

    if (cartItem.stock_quantity > 0 && quantity > cartItem.stock_quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${cartItem.stock_quantity} items available in stock`
      });
    }

    await query(
      'UPDATE cart SET quantity = ? WHERE id = ?',
      [quantity, cartId]
    );

    res.json({
      success: true,
      message: 'Cart updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const removeFromCart = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { cartId } = req.params;

    const result = await query(
      'DELETE FROM cart WHERE id = ? AND user_id = ?',
      [cartId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found'
      });
    }

    res.json({
      success: true,
      message: 'Item removed from cart'
    });
  } catch (error) {
    next(error);
  }
};

export const clearCart = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    await query('DELETE FROM cart WHERE user_id = ?', [userId]);

    res.json({
      success: true,
      message: 'Cart cleared successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const getCartSummary = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const cartItems = await query(
      `SELECT c.quantity, p.price, p.vendor_id
       FROM cart c
       JOIN products p ON c.product_id = p.id
       WHERE c.user_id = ? AND p.status = 1`,
      [userId]
    );

    if (cartItems.length === 0) {
      return res.json({
        success: true,
        data: {
          subtotal: 0,
          deliveryCharge: 0,
          total: 0,
          itemCount: 0
        }
      });
    }

    let subtotal = 0;
    const vendorId = cartItems[0].vendor_id;

    for (const item of cartItems) {
      subtotal += parseFloat(item.price) * item.quantity;
    }

    const [deliverySettings] = await query(
      'SELECT base_charge, free_distance_km, extra_charge_per_km FROM delivery_settings LIMIT 1'
    );
      const baseCharge = Number(deliverySettings?.base_charge ?? 25);
      const freeDistanceKm = Number(deliverySettings?.free_distance_km ?? 1.5);
      const extraChargePerKm = Number(deliverySettings?.extra_charge_per_km ?? 15);

      // Optional: pass ?distanceKm= in query to calculate extra km charge
      const distanceKm = Number(req.query?.distanceKm ?? req.query?.distance_km ?? 0);

      let deliveryCharge = baseCharge;
      if (Number.isFinite(distanceKm) && distanceKm > freeDistanceKm) {
        const extraKm = distanceKm - freeDistanceKm;
        deliveryCharge = baseCharge + (Math.ceil(extraKm) * extraChargePerKm);
      }
    res.json({
      success: true,
      data: {
        subtotal: parseFloat(subtotal.toFixed(2)),
        deliveryCharge: parseFloat(deliveryCharge),
        total: parseFloat((subtotal + deliveryCharge).toFixed(2)),
        itemCount: cartItems.length,
        vendorId
      }
    });
  } catch (error) {
    next(error);
  }
};
