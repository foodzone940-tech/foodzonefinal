import { query, transaction } from '../config/database.js';
import notificationService from '../services/notificationService.js';



export const getVendorBankDetails = async (req, res, next) => {
  try {
    const vendorId = req.user.userId;

    const [bank] = await query(
      `SELECT id, vendor_id, account_holder, account_number, ifsc_code, bank_name, branch_name, created_at
       FROM vendor_bank_details
       WHERE vendor_id = ?
       LIMIT 1`,
      [vendorId]
    );

    res.json({
      success: true,
      data: bank || null
    });
  } catch (error) {
    next(error);
  }
};

export const upsertVendorBankDetails = async (req, res, next) => {
  try {
    const vendorId = req.user.userId;
    const { accountHolder, accountNumber, ifscCode, bankName, branchName } = req.body;

    await query(
      `INSERT INTO vendor_bank_details (vendor_id, account_holder, account_number, ifsc_code, bank_name, branch_name)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         account_holder = VALUES(account_holder),
         account_number = VALUES(account_number),
         ifsc_code = VALUES(ifsc_code),
         bank_name = VALUES(bank_name),
         branch_name = VALUES(branch_name)`,
      [vendorId, accountHolder, accountNumber, ifscCode, bankName, branchName || null]
    );

    res.json({
      success: true,
      message: 'Bank details saved successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const getVendorDashboard = async (req, res, next) => {
  try {
    const vendorId = req.user.userId;    const [todayOrders] = await query(
      `SELECT
         COUNT(*) as count,
         COALESCE(SUM(vendor_amount), 0) as revenue
       FROM (
         SELECT
           o.id,
           COALESCE(SUM(oi.quantity * oi.price), (o.total_amount - o.delivery_charge)) AS vendor_amount
         FROM orders o
         LEFT JOIN order_items oi ON oi.order_id = o.id
         WHERE o.vendor_id = ? AND DATE(o.created_at) = CURDATE()
         GROUP BY o.id, o.total_amount, o.delivery_charge
       ) t`,
      [vendorId]
    );

const [totalOrders] = await query(
      'SELECT COUNT(*) as count FROM orders WHERE vendor_id = ?',
      [vendorId]
    );

    const [pendingOrders] = await query(
      `SELECT COUNT(*) as count FROM orders
       WHERE vendor_id = ? AND order_status IN ('PENDING', 'PLACED')`,
      [vendorId]
    );

    const [totalProducts] = await query(
      'SELECT COUNT(*) as count FROM products WHERE vendor_id = ? AND status = 1',
      [vendorId]
    );    const [totalRevenue] = await query(
      `SELECT COALESCE(SUM(vendor_amount), 0) as amount
       FROM (
         SELECT
           o.id,
           COALESCE(SUM(oi.quantity * oi.price), (o.total_amount - o.delivery_charge)) AS vendor_amount
         FROM orders o
         LEFT JOIN order_items oi ON oi.order_id = o.id
         WHERE o.vendor_id = ? AND o.payment_status = 'PAID'
         GROUP BY o.id, o.total_amount, o.delivery_charge
       ) t`,
      [vendorId]
    );

res.json({
      success: true,
      data: {
        todayOrders: todayOrders.count,
        todayRevenue: parseFloat(todayOrders.revenue),
        totalOrders: totalOrders.count,
        pendingOrders: pendingOrders.count,
        totalProducts: totalProducts.count,
        totalRevenue: parseFloat(totalRevenue.amount)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getVendorOrders = async (req, res, next) => {
  try {
    const vendorId = req.user.userId;
    const { status, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT o.*, u.name as customer_name, u.phone as customer_phone
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.vendor_id = ?
    `;

    const params = [vendorId];

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

export const updateOrderStatus = async (req, res, next) => {
  try {
    const vendorId = req.user.userId;
    const { orderId } = req.params;
    const { status } = req.body;

    const allowedStatuses = ['ACCEPTED', 'PREPARING', 'DISPATCHED', 'DELIVERED', 'CANCELLED'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order status'
      });
    }

    const [order] = await query(
      'SELECT * FROM orders WHERE id = ? AND vendor_id = ?',
      [orderId, vendorId]
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    await transaction(async (conn) => {
      const statusNorm = String(status || '').trim().toUpperCase();
      await conn.execute(
        `UPDATE orders
         SET order_status = ?,
             payment_status = CASE
               WHEN LOWER(TRIM(payment_mode)) = 'cod' AND ? = 'DELIVERED' THEN 'PAID'
               ELSE payment_status
             END
         WHERE id = ? AND vendor_id = ?`,
        [statusNorm, statusNorm, orderId, vendorId]
      );

      await conn.execute(
        'INSERT INTO order_status_history (order_id, status) VALUES (?, ?)',
        [orderId, statusNorm]
      );
    });

    await notificationService.sendOrderNotification(orderId, status);

    res.json({
      success: true,
      message: `Order status updated to ${status}`
    });
  } catch (error) {
    next(error);
  }
};

export const getVendorProducts = async (req, res, next) => {
  try {
    const vendorId = req.user.userId;
    const { category_id, status, search } = req.query;

    let sql = `
      SELECT p.*, c.name as category_name, COALESCE(i.quantity, 0) as stock_quantity
      FROM products p
      JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory_stock i ON p.id = i.product_id
      WHERE p.vendor_id = ?
    `;

    const params = [vendorId];

    if (category_id) {
      sql += ' AND p.category_id = ?';
      params.push(category_id);
    }

    if (status !== undefined) {
      sql += ' AND p.status = ?';
      params.push(status);
    }

    if (search) {
      sql += ' AND p.name LIKE ?';
      params.push(`%${search}%`);
    }

    sql += ' ORDER BY p.created_at DESC';

    const products = await query(sql, params);

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req, res, next) => {
  try {
    const vendorId = req.user.userId;
    const { name, description = null, price, categoryId, stock } = req.body;

    let image = null;
    if (req.file) {
      image = `/uploads/${req.file.filename}`;
    }

    const productId = await transaction(async (conn) => {
      const [result] = await conn.execute(
        `INSERT INTO products (vendor_id, category_id, name, description, price, image, status)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [vendorId, categoryId, name, description, price, image]
      );

      const productId = result.insertId;

      if (stock && parseInt(stock) > 0) {
        await conn.execute(
          'INSERT INTO inventory_stock (product_id, quantity) VALUES (?, ?)',
          [productId, parseInt(stock)]
        );
      }

      return productId;
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { productId }
    });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const vendorId = req.user.userId;
    const { productId } = req.params;
    const { name, description, price, categoryId, status, stock } = req.body;

    const [product] = await query(
      'SELECT * FROM products WHERE id = ? AND vendor_id = ?',
      [productId, vendorId]
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    let image = product.image;
    if (req.file) {
      image = `/uploads/${req.file.filename}`;
    }

    await transaction(async (conn) => {
      await conn.execute(
        `UPDATE products
         SET name = ?, description = ?, price = ?, category_id = ?, image = ?, status = ?
         WHERE id = ?`,
        [name ?? product.name, description ?? product.description, price ?? product.price, categoryId ?? product.category_id, image, status !== undefined ? status : product.status, productId]
      );

      if (stock !== undefined) {
        const [existingStock] = await conn.execute(
          'SELECT id FROM inventory_stock WHERE product_id = ?',
          [productId]
        );

        if (existingStock.length > 0) {
          await conn.execute(
            'UPDATE inventory_stock SET quantity = ? WHERE product_id = ?',
            [parseInt(stock), productId]
          );
        } else {
          await conn.execute(
            'INSERT INTO inventory_stock (product_id, quantity) VALUES (?, ?)',
            [productId, parseInt(stock)]
          );
        }
      }
    });

    res.json({
      success: true,
      message: 'Product updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const vendorId = req.user.userId;
    const { productId } = req.params;

    const [product] = await query(
      'SELECT * FROM products WHERE id = ? AND vendor_id = ?',
      [productId, vendorId]
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    await query('UPDATE products SET status = 0 WHERE id = ?', [productId]);

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const getVendorEarnings = async (req, res, next) => {
  try {
    const vendorId = req.user.userId;    const [totalEarnings] = await query(
      `SELECT COALESCE(SUM(vendor_amount), 0) as amount
       FROM (
         SELECT
           o.id,
           COALESCE(SUM(oi.quantity * oi.price), (o.total_amount - o.delivery_charge)) AS vendor_amount
         FROM orders o
         LEFT JOIN order_items oi ON oi.order_id = o.id
         WHERE o.vendor_id = ? AND o.payment_status = 'PAID'
         GROUP BY o.id, o.total_amount, o.delivery_charge
       ) t`,
      [vendorId]
    );    const [monthlyEarnings] = await query(
      `SELECT COALESCE(SUM(vendor_amount), 0) as amount
       FROM (
         SELECT
           o.id,
           COALESCE(SUM(oi.quantity * oi.price), (o.total_amount - o.delivery_charge)) AS vendor_amount
         FROM orders o
         LEFT JOIN order_items oi ON oi.order_id = o.id
         WHERE o.vendor_id = ? AND o.payment_status = 'PAID'
           AND MONTH(o.created_at) = MONTH(CURDATE())
           AND YEAR(o.created_at) = YEAR(CURDATE())
         GROUP BY o.id, o.total_amount, o.delivery_charge
       ) t`,
      [vendorId]
    );

const [pendingPayouts] = await query(
      `SELECT COALESCE(SUM(payout_amount), 0) as amount
       FROM vendor_payouts
       WHERE vendor_id = ? AND payout_status = 'pending'`,
      [vendorId]
    );

    const [completedPayouts] = await query(
      `SELECT COALESCE(SUM(payout_amount), 0) as amount
       FROM vendor_payouts
       WHERE vendor_id = ? AND payout_status = 'completed'`,
      [vendorId]
    );

    const payouts = await query(
      `SELECT * FROM vendor_payouts
       WHERE vendor_id = ?
       ORDER BY payout_date DESC
       LIMIT 10`,
      [vendorId]
    );

    res.json({
      success: true,
      data: {
        totalEarnings: parseFloat(totalEarnings.amount),
        monthlyEarnings: parseFloat(monthlyEarnings.amount),
        pendingPayouts: parseFloat(pendingPayouts.amount),
        completedPayouts: parseFloat(completedPayouts.amount),
        recentPayouts: payouts
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateVendorProfile = async (req, res, next) => {
  try {
    const vendorId = req.user.userId;
    const { vendorName, email, address, pincode } = req.body;

    const updates = {};

    if (vendorName) updates.vendor_name = vendorName;
    if (email) updates.email = email;
    if (address) updates.address = address;
    if (pincode) updates.pincode = pincode;

    if (req.files) {
      if (req.files.banner) {
        updates.banner = `/uploads/${req.files.banner[0].filename}`;
      }
      if (req.files.profile_photo) {
        updates.profile_photo = `/uploads/${req.files.profile_photo[0].filename}`;
      }
    }

    if (Object.keys(updates).length > 0) {
      const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = [...Object.values(updates), vendorId];

      await query(`UPDATE vendors SET ${setClause} WHERE id = ?`, values);
    }

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    next(error);
  }
};
