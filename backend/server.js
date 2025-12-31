import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { testConnection } from './src/config/database.js';
import { errorHandler, notFoundHandler } from './src/middleware/errorHandler.js';
import { generalLimiter } from './src/middleware/rateLimiter.js';
import paymentService from './src/services/paymentService.js';

import authRoutes from './src/routes/authRoutes.js';
import productRoutes from './src/routes/productRoutes.js';
import userRoutes from './src/routes/userRoutes.js';
import cartRoutes from './src/routes/cartRoutes.js';
import orderRoutes from './src/routes/orderRoutes.js';
import vendorRoutes from './src/routes/vendorRoutes.js';
import vendorAdminRoutes from './src/routes/vendorAdminRoutes.js';
import adminRoutes from './src/routes/adminRoutes.js';
import publicRoutes from './src/routes/publicRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 5000;

const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const corsOptions = {
  origin: [
    process.env.USER_APP_URL || 'http://localhost:3000',
    process.env.VENDOR_APP_URL || 'http://localhost:3001',
    process.env.ADMIN_APP_URL || 'http://localhost:3002',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

app.post('/api/webhooks/razorpay', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const payload = JSON.parse(req.body.toString());

    const result = await paymentService.handleWebhook(signature, payload);

    if (result.success) {
      res.json({ status: 'ok' });
    } else {
      res.status(400).json({ error: 'Invalid signature' });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, uploadDir)));

app.use(generalLimiter);

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/public', publicRoutes);

  app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/vendor-admin', vendorAdminRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async () => {
  try {
    const dbConnected = await testConnection();

    if (!dbConnected) {
      console.error('❌ Failed to connect to database. Exiting...');
      process.exit(1);
    }

    app.listen(PORT, () => {
      console.log('');
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║   🍔  FoodZone Backend API Server                         ║');
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log(`║   📡  Server running on port: ${PORT}                        ║`);
      console.log(`║   🌍  Environment: ${process.env.NODE_ENV || 'development'}                          ║`);
      console.log(`║   🗄️   Database: Connected                                 ║`);
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log('║   Available Endpoints:                                     ║');
      console.log('║   • GET  /health                  - Health check          ║');
      console.log('║   • POST /api/auth/*              - Authentication        ║');
      console.log('║   • GET  /api/products            - Products              ║');
      console.log('║   • *    /api/cart                - Cart operations       ║');
      console.log('║   • *    /api/orders              - Order management      ║');
      console.log('║   • *    /api/vendor              - Vendor panel          ║');
      console.log('║   • *    /api/admin               - Admin panel           ║');
      console.log('║   • POST /api/webhooks/razorpay   - Payment webhooks      ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log('');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
