import express from 'express';
import { body } from 'express-validator';
import multer from 'multer';
import path from 'path';
import {
  createOrder,
  verifyPayment,
  getUserOrders,
  getOrderById,
  cancelOrder,
  uploadPaymentScreenshot
} from '../controllers/orderController.js';
import { authMiddleware } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { paymentLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || './uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'payment-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only images (JPEG, PNG) and PDF files are allowed'));
  }
});

router.use(authMiddleware);

router.post(
  '/',
  [
    body('deliveryAddress').trim().notEmpty().withMessage('Delivery address is required'),
    body('paymentMode').isIn(['online', 'cod']).withMessage('Valid payment mode required')
  ],
  asyncHandler(createOrder)
);

router.post('/:orderId/verify-payment', paymentLimiter, asyncHandler(verifyPayment));

router.post(
  '/:orderId/upload-screenshot',
  upload.single('screenshot'),
  [
    body('paymentMethod').isIn(['paytm', 'phonepe', 'googlepay']).withMessage('Valid payment method required'),
    body('upiId').optional().trim(),
    body('transactionId').optional().trim()
  ],
  asyncHandler(uploadPaymentScreenshot)
);

router.get('/', asyncHandler(getUserOrders));
router.get('/:orderId', asyncHandler(getOrderById));

router.post(
  '/:orderId/cancel',
  [body('reason').optional().trim()],
  asyncHandler(cancelOrder)
);

export default router;
