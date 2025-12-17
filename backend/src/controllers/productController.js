import { query } from '../config/database.js';

export const getAllProducts = async (req, res, next) => {
  try {
    const { category_id, vendor_id, search, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT p.*, v.vendor_name, c.name as category_name,
             COALESCE(i.quantity, 0) as stock_quantity
      FROM products p
      JOIN vendors v ON p.vendor_id = v.id
      JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory_stock i ON p.id = i.product_id
      WHERE p.status = 1 AND v.status = 1
    `;

    const params = [];

    if (category_id) {
      sql += ' AND p.category_id = ?';
      params.push(category_id);
    }

    if (vendor_id) {
      sql += ' AND p.vendor_id = ?';
      params.push(vendor_id);
    }

    if (search) {
      sql += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const products = await query(sql, params);

    res.json({
      success: true,
      data: products,
      count: products.length
    });
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [product] = await query(
      `SELECT p.*, v.vendor_name, v.address as vendor_address,
              c.name as category_name,
              COALESCE(i.quantity, 0) as stock_quantity
       FROM products p
       JOIN vendors v ON p.vendor_id = v.id
       JOIN categories c ON p.category_id = c.id
       LEFT JOIN inventory_stock i ON p.id = i.product_id
       WHERE p.id = ?`,
      [id]
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const variants = await query(
      'SELECT * FROM product_variants WHERE product_id = ?',
      [id]
    );

    const addons = await query(
      'SELECT * FROM product_addons WHERE product_id = ?',
      [id]
    );

    const addonGroups = await query(
      'SELECT * FROM product_addon_groups WHERE product_id = ?',
      [id]
    );

    const [avgRating] = await query(
      `SELECT AVG(rating) as avg_rating, COUNT(*) as total_reviews
       FROM reviews_ratings
       WHERE product_id = ?`,
      [id]
    );

    const reviews = await query(
      `SELECT r.*, u.name as user_name
       FROM reviews_ratings r
       JOIN users u ON r.user_id = u.id
       WHERE r.product_id = ?
       ORDER BY r.created_at DESC
       LIMIT 10`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...product,
        variants,
        addons,
        addonGroups,
        avgRating: avgRating.avg_rating || 0,
        totalReviews: avgRating.total_reviews || 0,
        reviews
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getCategories = async (req, res, next) => {
  try {
    const categories = await query(
      'SELECT * FROM categories ORDER BY name ASC'
    );

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

export const getVendors = async (req, res, next) => {
  try {
    const { pincode, search } = req.query;

    let sql = `
      SELECT id, vendor_name, phone, email, address, pincode, lat, lng, image, banner
      FROM vendors
      WHERE status = 1
    `;

    const params = [];

    if (pincode) {
      sql += ' AND pincode = ?';
      params.push(pincode);
    }

    if (search) {
      sql += ' AND vendor_name LIKE ?';
      params.push(`%${search}%`);
    }

    sql += ' ORDER BY vendor_name ASC';

    const vendors = await query(sql, params);

    for (let vendor of vendors) {
      const [productCount] = await query(
        'SELECT COUNT(*) as count FROM products WHERE vendor_id = ? AND status = 1',
        [vendor.id]
      );
      vendor.productCount = productCount.count;
    }

    res.json({
      success: true,
      data: vendors
    });
  } catch (error) {
    next(error);
  }
};

export const getVendorById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [vendor] = await query(
      `SELECT id, vendor_name, phone, email, address, pincode, lat, lng, image, banner, profile_photo
       FROM vendors
       WHERE id = ? AND status = 1`,
      [id]
    );

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const products = await query(
      `SELECT p.*, c.name as category_name, COALESCE(i.quantity, 0) as stock_quantity
       FROM products p
       JOIN categories c ON p.category_id = c.id
       LEFT JOIN inventory_stock i ON p.id = i.product_id
       WHERE p.vendor_id = ? AND p.status = 1
       ORDER BY p.created_at DESC`,
      [id]
    );

    const timings = await query(
      'SELECT * FROM vendor_timings WHERE vendor_id = ?',
      [id]
    );

    res.json({
      success: true,
      data: {
        ...vendor,
        products,
        timings
      }
    });
  } catch (error) {
    next(error);
  }
};

export const addReview = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { rating, reviewText } = req.body;
    const userId = req.user.userId;

    const [existingOrder] = await query(
      `SELECT COUNT(*) as count
       FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       WHERE o.user_id = ? AND oi.product_id = ? AND o.order_status = 'DELIVERED'`,
      [userId, productId]
    );

    if (existingOrder.count === 0) {
      return res.status(403).json({
        success: false,
        message: 'You can only review products you have purchased'
      });
    }

    const [existingReview] = await query(
      'SELECT id FROM reviews_ratings WHERE user_id = ? AND product_id = ?',
      [userId, productId]
    );

    if (existingReview) {
      await query(
        'UPDATE reviews_ratings SET rating = ?, review_text = ? WHERE id = ?',
        [rating, reviewText, existingReview.id]
      );
    } else {
      await query(
        'INSERT INTO reviews_ratings (user_id, product_id, rating, review_text) VALUES (?, ?, ?, ?)',
        [userId, productId, rating, reviewText]
      );
    }

    res.json({
      success: true,
      message: 'Review submitted successfully'
    });
  } catch (error) {
    next(error);
  }
};
