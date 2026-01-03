import express from 'express';
import { query } from '../config/database.js';

const router = express.Router();

// Public UI Config (for website/app - no hardcode)


// Public Homepage Banners (active only)
router.get('/homepage-banners', async (req, res, next) => {
  try {
    const banners = await query(
      'SELECT id, image_url, banner_text, redirect_url FROM homepage_banners WHERE is_active = 1 ORDER BY id DESC'

      );

    return res.json({ success: true, data: banners, count: banners.length });
  } catch (error) {
    next(error);
  }
});

router.get('/ui-config', async (req, res, next) => {
  try {
    const configRows = await query('SELECT config_key, config_value FROM app_config ORDER BY config_key');
    const config = {};
    for (const row of configRows) config[row.config_key] = row.config_value;

    const banners = await query(
      'SELECT id, image_url, banner_text, redirect_url FROM homepage_banners WHERE is_active = 1 ORDER BY id DESC'
    );

      const deliveryRows = await query(
        'SELECT base_charge, free_distance_km, extra_charge_per_km FROM delivery_settings ORDER BY id DESC LIMIT 1'
      );
      const delivery_settings = deliveryRows[0] || null;


      const deliverySettings = delivery_settings ? {
          baseCharge: Number(delivery_settings.base_charge),
          freeDistanceKm: Number(delivery_settings.free_distance_km),
          extraChargePerKm: Number(delivery_settings.extra_charge_per_km)
        } : null;

        return res.json({ success: true, data: { ...config, banners, delivery_settings, deliverySettings } });
} catch (error) {
    next(error);
  }
});

export default router;
