import express from 'express';
import { query } from '../config/database.js';

const router = express.Router();

// Public UI Config (for website/app - no hardcode)
router.get('/ui-config', async (req, res, next) => {
  try {
    const configRows = await query('SELECT config_key, config_value FROM app_config ORDER BY config_key');
    const config = {};
    for (const row of configRows) config[row.config_key] = row.config_value;

    const banners = await query(
      'SELECT id, image_url, banner_text, redirect_url FROM homepage_banners WHERE is_active = 1 ORDER BY id DESC'
    );

    return res.json({ success: true, data: { config, banners } });
  } catch (error) {
    next(error);
  }
});

export default router;
