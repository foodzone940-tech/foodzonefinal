import bcrypt from 'bcrypt';
import { query, transaction } from '../config/database.js';

export const getAdminDashboard = async (req, res, next) => {
  try {
    const [totalUsers] = await query('SELECT COUNT(*) as count FROM users');
    const [totalVendors] = await query('SELECT COUNT(*) as count FROM vendors WHERE status = 1');
    const [totalOrders] = await query('SELECT COUNT(*) as count FROM orders');
    const [totalProducts] = await query('SELECT COUNT(*) as count FROM products WHERE status = 1');

    const [todayOrders] = await query(
      `SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue
       FROM orders WHERE DATE(created_at) = CURDATE()`
    );

    const [totalRevenue] = await query(
      `SELECT COALESCE(SUM(total_amount), 0) as amount
       FROM orders WHERE payment_status = 'PAID'`
    );

    const [pendingOrders] = await query(
      'SELECT COUNT(*) as count FROM orders WHERE order_status IN (\'PENDING\', \'PLACED\')'
    );

    const recentOrders = await query(
      `SELECT o.id, o.order_status, o.total_amount, o.created_at,
              u.name as customer_name, v.vendor_name
       FROM orders o
       JOIN users u ON o.user_id = u.id
       JOIN vendors v ON o.vendor_id = v.id
       ORDER BY o.created_at DESC LIMIT 10`
    );

    res.json({
      success: true,
      data: {
        totalUsers: totalUsers.count,
        totalVendors: totalVendors.count,
        totalOrders: totalOrders.count,
        totalProducts: totalProducts.count,
        todayOrders: todayOrders.count,
        todayRevenue: parseFloat(todayOrders.revenue),
        totalRevenue: parseFloat(totalRevenue.amount),
        pendingOrders: pendingOrders.count,
        recentOrders
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getAllUsers = async (req, res, next) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query;

    let sql = 'SELECT id, name, phone, email, address, pincode, created_at FROM users WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const users = await query(sql, params);

    for (const user of users) {
      const [orderCount] = await query(
        'SELECT COUNT(*) as count FROM orders WHERE user_id = ?',
        [user.id]
      );
      user.totalOrders = orderCount.count;
    }

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

export const getAllVendors = async (req, res, next) => {
  try {
    const { search, status, limit = 50, offset = 0 } = req.query;

    let sql = 'SELECT * FROM vendors WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND (vendor_name LIKE ? OR phone LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status !== undefined) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const vendors = await query(sql, params);

    for (const vendor of vendors) {
      const [orderCount] = await query(
        'SELECT COUNT(*) as count FROM orders WHERE vendor_id = ?',
        [vendor.id]
      );
      const [productCount] = await query(
        'SELECT COUNT(*) as count FROM products WHERE vendor_id = ? AND status = 1',
        [vendor.id]
      );
      const [earnings] = await query(
        `SELECT COALESCE(SUM(total_amount), 0) as amount
         FROM orders WHERE vendor_id = ? AND payment_status = 'PAID'`,
        [vendor.id]
      );

      vendor.totalOrders = orderCount.count;
      vendor.totalProducts = productCount.count;
      vendor.totalEarnings = parseFloat(earnings.amount);

      delete vendor.password;
    }

    res.json({
      success: true,
      data: vendors
    });
  } catch (error) {
    next(error);
  }
};

export const createVendor = async (req, res, next) => {
  try {
    const { vendorName, phone, email, password, address, pincode } = req.body;

    const [existing] = await query(
      'SELECT id FROM vendors WHERE phone = ?',
      [phone]
    );

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already registered'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO vendors (vendor_name, phone, email, password, address, pincode, status)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [vendorName, phone, email || null, hashedPassword, address || null, pincode || null]
    );

    await query(
      `INSERT INTO activity_logs (admin_id, action, ip_address)
       VALUES (?, ?, ?)`,
      [req.user.userId, `Created vendor: ${vendorName}`, req.ip]
    );

    res.status(201).json({
      success: true,
      message: 'Vendor created successfully',
      data: { vendorId: result.insertId }
    });
  } catch (error) {
    next(error);
  }
};

export const updateVendorStatus = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const { status } = req.body;

    const [vendor] = await query('SELECT vendor_name FROM vendors WHERE id = ?', [vendorId]);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    await query('UPDATE vendors SET status = ? WHERE id = ?', [status, vendorId]);

    await query(
      `INSERT INTO activity_logs (admin_id, action, ip_address)
       VALUES (?, ?, ?)`,
      [req.user.userId, `Updated vendor status: ${vendor.vendor_name} to ${status}`, req.ip]
    );

    res.json({
      success: true,
      message: 'Vendor status updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const getAllOrders = async (req, res, next) => {
  try {
    const { status, vendor_id, user_id, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT o.*, u.name as customer_name, u.phone as customer_phone,
             v.vendor_name
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN vendors v ON o.vendor_id = v.id
      WHERE 1=1
    `;

    const params = [];

    if (status) {
      sql += ' AND o.order_status = ?';
      params.push(status);
    }

    if (vendor_id) {
      sql += ' AND o.vendor_id = ?';
      params.push(vendor_id);
    }

    if (user_id) {
      sql += ' AND o.user_id = ?';
      params.push(user_id);
    }

    sql += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const orders = await query(sql, params);

    for (const order of orders) {
      const items = await query(
        `SELECT oi.*, p.name
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`,
        [order.id]
      );
      order.items = items;
    }

    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

export const getPaymentTransactions = async (req, res, next) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT pt.*, o.user_id, u.name as customer_name, v.vendor_name
      FROM payment_transactions pt
      JOIN orders o ON pt.order_id = o.id
      JOIN users u ON o.user_id = u.id
      JOIN vendors v ON o.vendor_id = v.id
      WHERE 1=1
    `;

    const params = [];

    if (status) {
      sql += ' AND pt.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY pt.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const transactions = await query(sql, params);

    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    next(error);
  }
};

export const processVendorPayout = async (req, res, next) => {
  try {
    const { vendorId, amount, remarks } = req.body;

    const [vendor] = await query('SELECT vendor_name FROM vendors WHERE id = ?', [vendorId]);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const result = await query(
      `INSERT INTO vendor_payouts (vendor_id, payout_amount, payout_status, remarks)
       VALUES (?, ?, 'completed', ?)`,
      [vendorId, amount, remarks || null]
    );

    await query(
      `INSERT INTO activity_logs (admin_id, action, ip_address)
       VALUES (?, ?, ?)`,
      [req.user.userId, `Processed payout for ${vendor.vendor_name}: ₹${amount}`, req.ip]
    );

    res.json({
      success: true,
      message: 'Payout processed successfully',
      data: { payoutId: result.insertId }
    });
  } catch (error) {
    next(error);
  }
};

export const verifyPaymentScreenshot = async (req, res, next) => {
  try {
    const { screenshotId } = req.params;
    const { status, remarks } = req.body;

    const [screenshot] = await query(
      'SELECT * FROM payment_screenshots WHERE id = ?',
      [screenshotId]
    );

    if (!screenshot) {
      return res.status(404).json({
        success: false,
        message: 'Payment screenshot not found'
      });
    }

    await transaction(async (conn) => {
      await conn.execute(
        'UPDATE payment_screenshots SET status = ? WHERE id = ?',
        [status, screenshotId]
      );

      if (status === 'verified') {
        await conn.execute(
          `UPDATE orders
           SET payment_status = 'PAID', order_status = 'PLACED'
           WHERE id = ?`,
          [screenshot.order_id]
        );

        await conn.execute(
          `INSERT INTO order_status_history (order_id, status)
           VALUES (?, 'PLACED')`,
          [screenshot.order_id]
        );

        await conn.execute(
          `INSERT INTO payment_transactions (order_id, transaction_id, payment_method, amount, status)
           VALUES (?, ?, ?, ?, 'success')`,
          [screenshot.order_id, screenshot.transaction_id || 'MANUAL_VERIFY', screenshot.payment_method, screenshot.amount]
        );
      } else if (status === 'rejected') {
        await conn.execute(
          `UPDATE orders
           SET payment_status = 'FAILED', order_status = 'CANCELLED'
           WHERE id = ?`,
          [screenshot.order_id]
        );
      }
    });

    await query(
      `INSERT INTO activity_logs (admin_id, action, ip_address)
       VALUES (?, ?, ?)`,
      [req.user.userId, `Payment screenshot ${status} for order #${screenshot.order_id}`, req.ip]
    );

    res.json({
      success: true,
      message: `Payment screenshot ${status} successfully`
    });
  } catch (error) {
    next(error);
  }
};

export const getActivityLogs = async (req, res, next) => {
  try {
    const { limit = 100, offset = 0 } = req.query;

    const logs = await query(
      `SELECT al.*, au.name as admin_name
       FROM activity_logs al
       JOIN admin_users au ON al.admin_id = au.id
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [parseInt(limit), parseInt(offset)]
    );

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    next(error);
  }
};

export const getErrorLogs = async (req, res, next) => {
  try {
    const { limit = 100, offset = 0 } = req.query;

    const logs = await query(
      `SELECT * FROM error_logs
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [parseInt(limit), parseInt(offset)]
    );

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    next(error);
  }
};

export const getAPILogs = async (req, res, next) => {
  try {
    const { limit = 100, offset = 0 } = req.query;

    const logs = await query(
      `SELECT * FROM api_logs
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [parseInt(limit), parseInt(offset)]
    );

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    next(error);
  }
};

export const updateDeliverySettings = async (req, res, next) => {
  try {
    const { baseCharge, freeDistanceKm, extraChargePerKm } = req.body;

    await query(
      `UPDATE delivery_settings
       SET base_charge = ?, free_distance_km = ?, extra_charge_per_km = ?
       WHERE id = 1`,
      [baseCharge, freeDistanceKm, extraChargePerKm]
    );

    await query(
      `INSERT INTO activity_logs (admin_id, action, ip_address)
       VALUES (?, ?, ?)`,
      [req.user.userId, 'Updated delivery settings', req.ip]
    );

    res.json({
      success: true,
      message: 'Delivery settings updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const createCoupon = async (req, res, next) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      startDate,
      endDate,
      usageLimit
    } = req.body;

    const result = await query(
      `INSERT INTO coupons (code, description, discount_type, discount_value, min_order_amount, start_date, end_date, usage_limit, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [code, description, discountType, discountValue, minOrderAmount || 0, startDate, endDate, usageLimit || 0]
    );

    await query(
      `INSERT INTO activity_logs (admin_id, action, ip_address)
       VALUES (?, ?, ?)`,
      [req.user.userId, `Created coupon: ${code}`, req.ip]
    );

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      data: { couponId: result.insertId }
    });
  } catch (error) {
    next(error);
  }
};
