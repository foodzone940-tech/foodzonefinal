import { query } from '../config/database.js';

export const getProfile = async (req, res, next) => {
  try {
    const userId = req.user?.userId;

    const [user] = await query(
      'SELECT id, name, phone, email, address, pincode FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    const { name, email, address, pincode } = req.body;

    await query(
      `UPDATE users
       SET name = COALESCE(?, name),
           email = COALESCE(?, email),
           address = COALESCE(?, address),
           pincode = COALESCE(?, pincode)
       WHERE id = ?`,
      [name ?? null, email ?? null, address ?? null, pincode ?? null, userId]
    );

    const [user] = await query(
      'SELECT id, name, phone, email, address, pincode FROM users WHERE id = ?',
      [userId]
    );

    res.json({ success: true, message: 'Profile updated', data: user });
  } catch (error) {
    next(error);
  }
};
