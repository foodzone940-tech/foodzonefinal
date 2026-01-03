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
    const { name, email, phone, address, pincode } = req.body;

      if (phone != null) {
        const ph = String(phone).trim();
        if (!/^[0-9]{10}$/.test(ph)) {
          return res.status(400).json({ success: false, message: 'Phone must be 10 digits' });
        }
        const [existing] = await query('SELECT id FROM users WHERE phone = ? AND id <> ? LIMIT 1', [ph, userId]);
        if (existing) {
          return res.status(400).json({ success: false, message: 'Phone number already in use' });
        }
      }


    await query(
      `UPDATE users
       SET name = COALESCE(?, name),
           email = COALESCE(?, email),
             phone = COALESCE(?, phone),
           address = COALESCE(?, address),
           pincode = COALESCE(?, pincode)
       WHERE id = ?`,
      [name ?? null, email ?? null, (phone ?? null), address ?? null, pincode ?? null, userId]
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
