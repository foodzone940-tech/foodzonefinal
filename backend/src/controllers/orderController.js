import { query, transaction } from '../config/database.js';
import paymentService from '../services/paymentService.js';
import notificationService from '../services/notificationService.js';

export const createOrder = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { deliveryAddress, paymentMode = 'online' } = req.body;

      // ONLINE_BLOCK_EARLY_V1
      if (paymentMode === 'online' || paymentMode === 'cod') {
        return res.status(400).json({ success: false, message: 'Only scanner/upi/qr allowed.' });
      }


    const cartItems = await query(
      `SELECT c.*, p.name, p.price, p.vendor_id, COALESCE(i.quantity, 0) as stock_quantity
       FROM cart c
       JOIN products p ON c.product_id = p.id
       LEFT JOIN inventory_stock i ON p.id = i.product_id
       WHERE c.user_id = ? AND p.status = 1`,
      [userId]
    );

    if (cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }

    for (const item of cartItems) {
      if (item.stock_quantity > 0 && item.quantity > item.stock_quantity) {
        return res.status(400).json({
          success: false,
          message: `${item.name} has only ${item.stock_quantity} items in stock`
        });
      }
    }

    const vendorId = cartItems[0].vendor_id;
    let subtotal = 0;

    for (const item of cartItems) {
      subtotal += parseFloat(item.price) * item.quantity;
    }

    const [deliverySettings] = await query(
        'SELECT base_charge, free_distance_km, extra_charge_per_km FROM delivery_settings LIMIT 1'
      );

      const baseCharge = Number(deliverySettings?.base_charge ?? 25);
      const freeDistanceKm = Number(deliverySettings?.free_distance_km ?? 1.5);
      const extraChargePerKm = Number(deliverySettings?.extra_charge_per_km ?? 15);

      // Optional: distance can be passed in body/query
      const distanceKm = Number(
        req.body?.distanceKm ??
        req.body?.distance_km ??
        req.query?.distanceKm ??
        req.query?.distance_km ??
        0
      );

      let deliveryCharge = baseCharge;
      if (Number.isFinite(distanceKm) && distanceKm > freeDistanceKm) {
        const extraKm = distanceKm - freeDistanceKm;
        deliveryCharge = baseCharge + (Math.ceil(extraKm) * extraChargePerKm);
      }

      const totalAmount = subtotal + deliveryCharge;
const orderId = await transaction(async (conn) => {
      const [orderResult] = await conn.execute(
        `INSERT INTO orders (user_id, vendor_id, delivery_address, total_amount, delivery_charge, payment_mode, payment_status, order_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, vendorId, deliveryAddress, totalAmount, deliveryCharge, paymentMode, 'PENDING', 'PENDING']
      );

      const orderId = orderResult.insertId;

      for (const item of cartItems) {
        await conn.execute(
          'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
          [orderId, item.product_id, item.quantity, item.price]
        );

        if (item.stock_quantity > 0) {
          await conn.execute(
            'UPDATE inventory_stock SET quantity = quantity - ? WHERE product_id = ?',
            [item.quantity, item.product_id]
          );
        }
      }

      await conn.execute(
        'INSERT INTO order_status_history (order_id, status) VALUES (?, ?)',
        [orderId, 'PENDING']
      );

      await conn.execute('DELETE FROM cart WHERE user_id = ?', [userId]);

      return orderId;
    });

    if (paymentMode === 'online') {
const paymentOrder = await paymentService.createOrder(orderId, totalAmount);

      return res.json({
        success: true,
        message: 'Order created successfully',
        data: {
          orderId,
          totalAmount,
          paymentRequired: true,
          paymentDetails: paymentOrder
        }
      });
    } else if (paymentMode === 'cod') {
      await query(
        'UPDATE orders SET payment_status = ?, order_status = ? WHERE id = ?',
        ['COD', 'PLACED', orderId]
      );

      await query(
        'INSERT INTO order_status_history (order_id, status) VALUES (?, ?)',
        [orderId, 'PLACED']
      );

      await notificationService.sendOrderNotification(orderId, 'PLACED');

      return res.json({
        success: true,
        message: 'Order placed successfully with COD',
        data: {
          orderId,
          totalAmount,
          paymentRequired: false
        }
      });
    } else if (paymentMode === 'scanner' || paymentMode === 'upi' || paymentMode === 'qr') {
        await query(
          'UPDATE orders SET payment_status = ?, order_status = ? WHERE id = ?',
          ['PENDING_QR', 'PLACED', orderId]
        );

        await query(
          'INSERT INTO order_status_history (order_id, status) VALUES (?, ?)',
          [orderId, 'PLACED']
        );

        await notificationService.sendOrderNotification(orderId, 'PLACED');

        return res.json({
          success: true,
          message: 'Order placed. Pay via QR and wait for confirmation.',
          data: {
            orderId,
            totalAmount,
            paymentRequired: true,
            paymentMode: 'scanner'
          }
        });
      }


    res.json({
      success: true,
      message: 'Order created',
      data: { orderId, totalAmount }
    });
  } catch (error) {
    next(error);
  }
};

export const verifyPayment = async (req, res, next) => {
  try {
      // RAZORPAY_DISABLED
      return res.status(400).json({ success: false, message: 'Online payment disabled. Use scanner/upi/qr.' });

    const { orderId } = req.params;
    const paymentData = req.body;

    const result = await paymentService.verifyPayment(orderId, paymentData);

    if (result.success) {
      await notificationService.sendOrderNotification(orderId, 'PLACED');
      await notificationService.sendPaymentNotification(orderId, 'success');
    } else {
      await notificationService.sendPaymentNotification(orderId, 'failed');
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getUserOrders = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { status, limit = 20, offset = 0 } = req.query;

    let sql = `
      SELECT o.*, v.vendor_name, v.phone as vendor_phone
      FROM orders o
      JOIN vendors v ON o.vendor_id = v.id
      WHERE o.user_id = ?
    `;

    const params = [userId];

    if (status) {
      sql += ' AND o.order_status = ?';
      params.push(status);
    }

    sql += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const orders = await query(sql, params);

    for (const order of orders) {
      const items = await query(
        `SELECT oi.*, p.name, p.image
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`,
        [order.id]
      );
      order.items = items;
    }

    res.json({
      success: true,
      data: orders,
      count: orders.length
    });
  } catch (error) {
    next(error);
  }
};

export const getOrderById = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;

    const [order] = await query(
      `SELECT o.*, v.vendor_name, v.phone as vendor_phone, v.address as vendor_address
       FROM orders o
       JOIN vendors v ON o.vendor_id = v.id
       WHERE o.id = ? AND o.user_id = ?`,
      [orderId, userId]
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const items = await query(
      `SELECT oi.*, p.name, p.image
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [orderId]
    );

    const statusHistory = await query(
      'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY changed_at ASC',
      [orderId]
    );

    res.json({
      success: true,
      data: {
        ...order,
        items,
        statusHistory
      }
    });
  } catch (error) {
    next(error);
  }
};

export const cancelOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;
    const { reason } = req.body;

    const [order] = await query(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [orderId, userId]
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (['DELIVERED', 'CANCELLED'].includes(order.order_status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel this order'
      });
    }

    await transaction(async (conn) => {
      await conn.execute(
        'UPDATE orders SET order_status = ? WHERE id = ?',
        ['CANCELLED', orderId]
      );

      await conn.execute(
        'INSERT INTO order_status_history (order_id, status) VALUES (?, ?)',
        [orderId, 'CANCELLED']
      );

      const items = await conn.execute(
        'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
        [orderId]
      );

      for (const item of items[0]) {
        await conn.execute(
          `UPDATE inventory_stock
           SET quantity = quantity + ?
           WHERE product_id = ?`,
          [item.quantity, item.product_id]
        );
      }

      if (order.payment_status === 'PAID') {
        await paymentService.processRefund(orderId, order.total_amount, reason || 'Order cancelled by user');
      }
    });

    await notificationService.sendOrderNotification(orderId, 'CANCELLED');

    res.json({
      success: true,
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const uploadPaymentScreenshot = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;
    const { paymentMethod, upiId, transactionId } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Screenshot file is required'
      });
    }

    const [order] = await query(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [orderId, userId]
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const screenshotUrl = `/uploads/${req.file.filename}`;

    await query(
      `INSERT INTO payment_screenshots (order_id, payment_method, screenshot_url, upi_id, amount, transaction_id, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [orderId, paymentMethod, screenshotUrl, (upiId || null), order.total_amount, (transactionId || null)]
    );

    await query(
      'UPDATE orders SET payment_screenshot = ?, payment_status = ? WHERE id = ?',
      [screenshotUrl, 'VERIFICATION_PENDING', orderId]
    );

    res.json({
      success: true,
      message: 'Payment screenshot uploaded. Verification pending.',
      data: { screenshotUrl }
    });
  } catch (error) {
    next(error);
  }
};
