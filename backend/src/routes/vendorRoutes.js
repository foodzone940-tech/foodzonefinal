import express from 'express';
import { body } from 'express-validator';
import multer from 'multer';
import path from 'path';
import {
  getVendorDashboard,
  getVendorOrders,
  updateOrderStatus,
  getVendorProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getVendorEarnings,
  updateVendorProfile
} from '../controllers/vendorController.js';
import { vendorAuthMiddleware } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || './uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files (JPEG, PNG) are allowed'));
  }
});

router.use(vendorAuthMiddleware);

router.get('/dashboard', asyncHandler(getVendorDashboard));
router.get('/orders', asyncHandler(getVendorOrders));

router.put(
  '/orders/:orderId/status',
  [
    body('status')
      .isIn(['ACCEPTED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'])
      .withMessage('Invalid order status')
  ],
  asyncHandler(updateOrderStatus)
);

router.get('/products', asyncHandler(getVendorProducts));

router.post(
  '/products',
  upload.single('image'),
  [
    body('name').trim().notEmpty().withMessage('Product name is required'),
    body('price').isFloat({ min: 0 }).withMessage('Valid price required'),
    body('categoryId').isInt().withMessage('Valid category ID required'),
    body('description').optional().trim(),
    body('stock').optional().isInt({ min: 0 })
  ],
  asyncHandler(createProduct)
);

router.put(
  '/products/:productId',
  upload.single('image'),
  [
    body('name').optional().trim().notEmpty(),
    body('price').optional().isFloat({ min: 0 }),
    body('categoryId').optional().isInt(),
    body('description').optional().trim(),
    body('status').optional().isIn([0, 1, '0', '1']),
    body('stock').optional().isInt({ min: 0 })
  ],
  asyncHandler(updateProduct)
);

router.delete('/products/:productId', asyncHandler(deleteProduct));

router.get('/earnings', asyncHandler(getVendorEarnings));

router.put(
  '/profile',
  upload.fields([
    { name: 'banner', maxCount: 1 },
    { name: 'profile_photo', maxCount: 1 }
  ]),
  [
    body('vendorName').optional().trim(),
    body('email').optional().isEmail(),
    body('address').optional().trim(),
    body('pincode').optional().trim()
  ],
  asyncHandler(updateVendorProfile)
);

export default router;
