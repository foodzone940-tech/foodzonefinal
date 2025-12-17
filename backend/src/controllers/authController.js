import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
import otpService from '../services/otpService.js';

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  });
};

const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  });
};

export const userRegister = async (req, res, next) => {
  try {
    const { name, phone, email, password, address, pincode } = req.body;

    const [existingUser] = await query(
      'SELECT id FROM users WHERE phone = ?',
      [phone]
    );

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already registered'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (name, phone, email, password, address, pincode)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, phone, email || null, hashedPassword, address || null, pincode || null]
    );

    const userId = result.insertId;

    await otpService.sendOTP(phone, userId);

    res.status(201).json({
      success: true,
      message: 'Registration successful. OTP sent to your phone.',
      data: { userId, phone }
    });
  } catch (error) {
    next(error);
  }
};

export const userLogin = async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    const [user] = await query(
      'SELECT * FROM users WHERE phone = ?',
      [phone]
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone number or password'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone number or password'
      });
    }

    const token = generateToken({
      userId: user.id,
      phone: user.phone,
      role: 'user'
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      role: 'user'
    });

    delete user.password;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        token,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

export const userLoginWithOTP = async (req, res, next) => {
  try {
    const { phone } = req.body;

    let [user] = await query(
      'SELECT id, name, phone FROM users WHERE phone = ?',
      [phone]
    );

    if (!user) {
      const defaultPassword = await bcrypt.hash('default123', 10);
      const result = await query(
        `INSERT INTO users (name, phone, password)
         VALUES (?, ?, ?)`,
        ['User', phone, defaultPassword]
      );
      user = { id: result.insertId, name: 'User', phone };
    }

    await otpService.sendOTP(phone, user.id);

    res.json({
      success: true,
      message: 'OTP sent to your phone',
      data: { userId: user.id, phone }
    });
  } catch (error) {
    next(error);
  }
};

export const verifyUserOTP = async (req, res, next) => {
  try {
    const { userId, otp } = req.body;

    const verification = await otpService.verifyOTP(userId, otp);

    if (!verification.success) {
      return res.status(400).json(verification);
    }

    const [user] = await query(
      'SELECT id, name, phone, email, address, pincode FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const token = generateToken({
      userId: user.id,
      phone: user.phone,
      role: 'user'
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      role: 'user'
    });

    res.json({
      success: true,
      message: 'OTP verified successfully',
      data: {
        user,
        token,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

export const vendorLogin = async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    const [vendor] = await query(
      'SELECT * FROM vendors WHERE phone = ?',
      [phone]
    );

    if (!vendor) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone number or password'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, vendor.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone number or password'
      });
    }

    if (vendor.status !== 1) {
      return res.status(403).json({
        success: false,
        message: 'Your account is inactive. Please contact admin.'
      });
    }

    const token = generateToken({
      userId: vendor.id,
      phone: vendor.phone,
      role: 'vendor'
    });

    const refreshToken = generateRefreshToken({
      userId: vendor.id,
      role: 'vendor'
    });

    delete vendor.password;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        vendor,
        token,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

export const vendorLoginWithOTP = async (req, res, next) => {
  try {
    const { phone } = req.body;

    const [vendor] = await query(
      'SELECT id, vendor_name, phone, status FROM vendors WHERE phone = ?',
      [phone]
    );

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found with this phone number'
      });
    }

    if (vendor.status !== 1) {
      return res.status(403).json({
        success: false,
        message: 'Your account is inactive. Please contact admin.'
      });
    }

    await otpService.sendOTP(phone, vendor.id);

    res.json({
      success: true,
      message: 'OTP sent to your phone',
      data: { vendorId: vendor.id, phone }
    });
  } catch (error) {
    next(error);
  }
};

export const verifyVendorOTP = async (req, res, next) => {
  try {
    const { vendorId, otp } = req.body;

    const verification = await otpService.verifyOTP(vendorId, otp);

    if (!verification.success) {
      return res.status(400).json(verification);
    }

    const [vendor] = await query(
      `SELECT id, vendor_name, phone, email, address, pincode, status, banner, profile_photo
       FROM vendors WHERE id = ?`,
      [vendorId]
    );

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const token = generateToken({
      userId: vendor.id,
      phone: vendor.phone,
      role: 'vendor'
    });

    const refreshToken = generateRefreshToken({
      userId: vendor.id,
      role: 'vendor'
    });

    res.json({
      success: true,
      message: 'OTP verified successfully',
      data: {
        vendor,
        token,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

export const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const [admin] = await query(
      'SELECT * FROM admin_users WHERE email = ?',
      [email]
    );

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (admin.is_active !== 1) {
      return res.status(403).json({
        success: false,
        message: 'Your account is inactive.'
      });
    }

    const token = generateToken({
      userId: admin.id,
      email: admin.email,
      role: 'admin'
    });

    const refreshToken = generateRefreshToken({
      userId: admin.id,
      role: 'admin'
    });

    await query(
      `INSERT INTO activity_logs (admin_id, action, ip_address)
       VALUES (?, ?, ?)`,
      [admin.id, 'Login', req.ip]
    );

    delete admin.password;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        admin,
        token,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

export const refreshAccessToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const newToken = generateToken({
      userId: decoded.userId,
      role: decoded.role,
      ...(decoded.phone && { phone: decoded.phone }),
      ...(decoded.email && { email: decoded.email })
    });

    res.json({
      success: true,
      data: { token: newToken }
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token'
    });
  }
};
