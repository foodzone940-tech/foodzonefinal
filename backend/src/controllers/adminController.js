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


        const [bankRow] = await query(
          'SELECT id FROM vendor_bank_details WHERE vendor_id = ? LIMIT 1',
          [vendor.id]
        );
        vendor.hasBankDetails = !!bankRow;
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


export const getVendorBankDetails = async (req, res, next) => {
  try {
    const { vendorId } = req.params;

    const [vendor] = await query(
      'SELECT id, vendor_name FROM vendors WHERE id = ?',
      [vendorId]
    );

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const [bank] = await query(
      `SELECT id, vendor_id, account_holder, account_number, ifsc_code, bank_name, branch_name, created_at
       FROM vendor_bank_details
       WHERE vendor_id = ?
       LIMIT 1`,
      [vendorId]
    );

    res.json({
      success: true,
      data: {
        vendor,
        bank: bank || null
      }
    });
  } catch (error) {
    next(error);
  }
};

export const createVendor = async (req, res, next) => {
  try {
    const { vendorName, phone, email, password, address, pincode } = req.body;

    if (!vendorName) return res.status(400).json({ success: false, message: 'Vendor name is required' });
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });
    if (!password) return res.status(400).json({ success: false, message: 'Password is required' });

    const [existingEmail] = await query('SELECT id FROM vendors WHERE email = ?', [email]);
    if (existingEmail) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // DB requires phone NOT NULL -> generate if not provided
    let phoneValue = phone;

    if (!phoneValue) {
      for (let i = 0; i < 20; i++) {
        const candidate = '9' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0'); // 10-digit
        const [exists] = await query('SELECT id FROM vendors WHERE phone = ?', [candidate]);
        if (!exists) { phoneValue = candidate; break; }
      }
      if (!phoneValue) return res.status(500).json({ success: false, message: 'Failed to generate phone number' });
    } else {
      const [existingPhone] = await query('SELECT id FROM vendors WHERE phone = ?', [phoneValue]);
      if (existingPhone) return res.status(400).json({ success: false, message: 'Phone number already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await query(
      'INSERT INTO vendors (vendor_name, phone, email, password, address, pincode, status) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [vendorName, phoneValue, email, hashedPassword, address || null, pincode || null]
    );

    await query(
      'INSERT INTO activity_logs (admin_id, action, ip_address) VALUES (?, ?, ?)',
      [req.user.userId, 'Created vendor: ' + vendorName + ' (' + email + ')', req.ip]
    );

    res.status(201).json({
      success: true,
      message: 'Vendor created successfully',
      data: { vendorId: result.insertId, phone: phoneValue }
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


export const getPaymentScreenshots = async (req, res, next) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT
        ps.id,
        ps.order_id,
        ps.payment_method,
        ps.screenshot_url,
        ps.upi_id,
        ps.amount,
        ps.transaction_id,
        ps.status,
        ps.uploaded_at,
        o.user_id,
        o.total_amount,
        o.payment_status,
        o.order_status,
        u.name AS user_name,
        u.phone AS user_phone
      FROM payment_screenshots ps
      JOIN orders o ON o.id = ps.order_id
      LEFT JOIN users u ON u.id = o.user_id
      WHERE 1=1
    `;

    const params = [];

    if (status) {
      sql += " AND ps.status = ?";
      params.push(status);
    }

    sql += " ORDER BY ps.id DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), parseInt(offset));

    const rows = await query(sql, params);

    res.json({ success: true, data: rows, count: rows.length });
  } catch (error) {
    next(error);
  }
};

export const verifyPaymentScreenshot = async (req, res, next) => {
  try {
    const { screenshotId } = req.params;
    const { status, remarks } = req.body;

    
      

      const sid = parseInt(screenshotId, 10);
      if (Number.isNaN(sid)) {
        return res.status(400).json({ success: false, message: 'Valid screenshotId is required' });
      }

      const adminId = (req.admin && req.admin.id) || (req.user && req.user.userId);
      if (!adminId) {
        return res.status(401).json({ success: false, message: 'Admin token required' });
      }
if (!status || !['verified','rejected'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'status is required (verified/rejected)'
        });
      }
const [screenshot] = await query(
      'SELECT * FROM payment_screenshots WHERE id = ?',
      [sid]
    );

    if (!screenshot) {
      return res.status(404).json({
        success: false,
        message: 'Payment screenshot not found'
      });
    }

      await transaction(async (conn) => {
        // lock order row so a rejected screenshot can't override a PAID order
        const [orderRows] = await conn.execute(
          'SELECT payment_status, order_status FROM orders WHERE id = ? FOR UPDATE',
          [screenshot.order_id]
        );
        const currentPaymentStatus = (orderRows && orderRows[0]) ? orderRows[0].payment_status : null;

        
          const currentOrderStatus = (orderRows && orderRows[0]) ? orderRows[0].order_status : null;await conn.execute(
          'UPDATE payment_screenshots SET status = ? WHERE id = ?',
          [status, sid]
        );

        if (status === 'verified') {
          const txId = screenshot.transaction_id || 'MANUAL_VERIFY';

          // Don't downgrade order status (e.g., DELIVERED -> PLACED)
          if (!currentOrderStatus || currentOrderStatus === 'PENDING') {
            await conn.execute(
              `UPDATE orders
               SET payment_status = 'PAID', order_status = 'PLACED', transaction_id = ?
               WHERE id = ?`,
              [txId, screenshot.order_id]
            );

            await conn.execute(
              `INSERT INTO order_status_history (order_id, status)
               VALUES (?, 'PLACED')`,
              [screenshot.order_id]
            );
          } else {
            await conn.execute(
              `UPDATE orders
               SET payment_status = 'PAID', transaction_id = ?
               WHERE id = ?`,
              [txId, screenshot.order_id]
            );
          }

          await conn.execute(
              `INSERT INTO payment_transactions (order_id, transaction_id, payment_method, amount, status)
               VALUES (?, ?, ?, ?, 'success')
               ON DUPLICATE KEY UPDATE
                 transaction_id = VALUES(transaction_id),
                 payment_method = VALUES(payment_method),
                 amount = VALUES(amount),
                 status = 'success'`,
              [screenshot.order_id, txId, screenshot.payment_method, screenshot.amount]
            );
// auto-close other pending screenshots for same order
          await conn.execute(
            "UPDATE payment_screenshots SET status = ? WHERE order_id = ? AND id <> ? AND status IN ('pending','verified')",
            ['rejected', screenshot.order_id, sid]
          );
        } else if (status === 'rejected') {
          // DO NOT override a PAID or DELIVERED order
          if (currentPaymentStatus !== 'PAID' && currentOrderStatus !== 'DELIVERED') {
            await conn.execute(
              `UPDATE orders
               SET payment_status = 'FAILED', order_status = 'CANCELLED'
               WHERE id = ?`,
              [screenshot.order_id]
            );
          }
        }
      });
await query(
      `INSERT INTO activity_logs (admin_id, action, ip_address)
       VALUES (?, ?, ?)`,
      [adminId, `Payment screenshot ${status} for order #${screenshot.order_id}`, req.ip]
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


export const getDeliverySettings = async (req, res, next) => {
  try {
    const rows = await query(
      'SELECT base_charge, free_distance_km, extra_charge_per_km FROM delivery_settings ORDER BY id DESC LIMIT 1'
    );

    const d = rows[0] || null;

    return res.json({
      success: true,
      data: d
        ? {
            baseCharge: Number(d.base_charge),
            freeDistanceKm: Number(d.free_distance_km),
            extraChargePerKm: Number(d.extra_charge_per_km)
          }
        : null
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


// ---------------- Homepage Banners (Master Admin) ----------------
export const getHomepageBanners = async (req, res, next) => {
  try {
    const rows = await query('SELECT * FROM homepage_banners ORDER BY id DESC');
    return res.json({ success: true, data: rows, count: rows.length });
  } catch (error) {
    next(error);
  }
};

export const createHomepageBanner = async (req, res, next) => {
  try {
    const { bannerText, redirectUrl, isActive } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Banner image is required' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    const activeVal = (isActive === undefined || isActive === null) ? 1 : (String(isActive) === '1' ? 1 : 0);

    const result = await query(
      `INSERT INTO homepage_banners (image_url, banner_text, redirect_url, is_active)
       VALUES (?, ?, ?, ?)`,
      [imageUrl, bannerText || null, redirectUrl || null, activeVal]
    );

    const adminId = (req.admin && req.admin.id) || (req.user && req.user.userId);
    if (adminId) {
      await query(
        `INSERT INTO activity_logs (admin_id, action, ip_address) VALUES (?, ?, ?)`,
        [adminId, `Created homepage banner #${result.insertId}`, req.ip]
      );
    }

    const rows = await query('SELECT * FROM homepage_banners WHERE id = ?', [result.insertId]);
    return res.status(201).json({ success: true, message: 'Banner created', data: rows[0] || null });
  } catch (error) {
    next(error);
  }
};

export const updateHomepageBanner = async (req, res, next) => {
  try {
    const { bannerId } = req.params;
    const id = parseInt(bannerId, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Valid bannerId is required' });
    }

    const [exists] = await query('SELECT id FROM homepage_banners WHERE id = ? LIMIT 1', [id]);
    if (!exists) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    const { bannerText, redirectUrl, isActive } = req.body;

    const sets = [];
    const params = [];

    if (bannerText !== undefined) {
      const v = String(bannerText).trim();
      sets.push("banner_text = ?");
      params.push(v === "" ? null : v);
}

    if (redirectUrl !== undefined) {
      const v = String(redirectUrl).trim();
      sets.push("redirect_url = ?");
      params.push(v === "" ? null : v);
}

    if (isActive !== undefined) {
      sets.push("is_active = ?");
      params.push(String(isActive) === '1' ? 1 : 0);
    }

    if (req.file) {
      sets.push("image_url = ?");
      params.push(`/uploads/${req.file.filename}`);
    }

    if (sets.length === 0) {
      return res.status(400).json({ success: false, message: 'Nothing to update' });
    }

    params.push(id);
    await query(`UPDATE homepage_banners SET ${sets.join(', ')} WHERE id = ?`, params);

    const adminId = (req.admin && req.admin.id) || (req.user && req.user.userId);
    if (adminId) {
      await query(
        `INSERT INTO activity_logs (admin_id, action, ip_address) VALUES (?, ?, ?)`,
        [adminId, `Updated homepage banner #${id}`, req.ip]
      );
    }

    const rows = await query('SELECT * FROM homepage_banners WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Banner updated', data: rows[0] || null });
  } catch (error) {
    next(error);
  }
};

export const deleteHomepageBanner = async (req, res, next) => {
  try {
    const { bannerId } = req.params;
    const id = parseInt(bannerId, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Valid bannerId is required' });
    }

    const [exists] = await query('SELECT id FROM homepage_banners WHERE id = ? LIMIT 1', [id]);
    if (!exists) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    await query('DELETE FROM homepage_banners WHERE id = ?', [id]);

    const adminId = (req.admin && req.admin.id) || (req.user && req.user.userId);
    if (adminId) {
      await query(
        `INSERT INTO activity_logs (admin_id, action, ip_address) VALUES (?, ?, ?)`,
        [adminId, `Deleted homepage banner #${id}`, req.ip]
      );
    }

    return res.json({ success: true, message: 'Banner deleted' });
  } catch (error) {
    next(error);
  }
};
// ---------------- App Config (Branding/Assets) ----------------
export const getAppConfig = async (req, res, next) => {
  try {
    const rows = await query('SELECT config_key, config_value FROM app_config ORDER BY config_key');
    return res.json({ success: true, data: rows, count: rows.length });
  } catch (error) {
    next(error);
  }
};

const isValidConfigKey = (k) => /^[a-zA-Z0-9_-]{2,100}$/.test(String(k || ''));

export const setAppConfigValue = async (req, res, next) => {
  try {
    const { key } = req.params;
    if (!isValidConfigKey(key)) {
      return res.status(400).json({ success: false, message: 'Invalid config key' });
    }

    const value = (req.body && req.body.value !== undefined) ? String(req.body.value) : null;

    await query(
      `INSERT INTO app_config (config_key, config_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)`,
      [key, value]
    );

    const adminId = (req.admin && req.admin.id) || (req.user && req.user.userId);
    if (adminId) {
      await query(
        `INSERT INTO activity_logs (admin_id, action, ip_address) VALUES (?, ?, ?)`,
        [adminId, `Updated app_config value: ${key}`, req.ip]
      );
    }

    const rows = await query('SELECT config_key, config_value FROM app_config WHERE config_key = ? LIMIT 1', [key]);
    return res.json({ success: true, message: 'Config updated', data: rows[0] || null });
  } catch (error) {
    next(error);
  }
};

export const setAppConfigImage = async (req, res, next) => {
  try {
    const { key } = req.params;
    if (!isValidConfigKey(key)) {
      return res.status(400).json({ success: false, message: 'Invalid config key' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Image file is required' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;

    await query(
      `INSERT INTO app_config (config_key, config_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)`,
      [key, imageUrl]
    );

    const adminId = (req.admin && req.admin.id) || (req.user && req.user.userId);
    if (adminId) {
      await query(
        `INSERT INTO activity_logs (admin_id, action, ip_address) VALUES (?, ?, ?)`,
        [adminId, `Updated app_config image: ${key}`, req.ip]
      );
    }

    const rows = await query('SELECT config_key, config_value FROM app_config WHERE config_key = ? LIMIT 1', [key]);
    return res.json({ success: true, message: 'Config image updated', data: rows[0] || null });
  } catch (error) {
    next(error);
  }
};
