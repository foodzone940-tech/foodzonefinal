import express from 'express';
import { body } from 'express-validator';
import multer from 'multer';
import path from 'path';
import {
  getAdminDashboard,
  getAllUsers,
  getAllVendors,
    getVendorBankDetails,
  createVendor,
  updateVendorStatus,
  getAllOrders,
  getPaymentTransactions,
  processVendorPayout,
  verifyPaymentScreenshot,
  getActivityLogs,
  getErrorLogs,
  getAPILogs,
  updateDeliverySettings,
  createCoupon,
    getPaymentScreenshots,
    getHomepageBanners,
    createHomepageBanner,
    updateHomepageBanner,
    deleteHomepageBanner,
      getAppConfig,
      setAppConfigValue,
      setAppConfigImage,
} from '../controllers/adminController.js';
import { adminAuthMiddleware } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || './uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(new Error('Only image files (JPEG, PNG, WEBP) are allowed'));
  }
});


router.use(adminAuthMiddleware);

router.get('/homepage-banners', asyncHandler(getHomepageBanners));

router.post(
  '/homepage-banners',
  upload.single('image'),
  [
    body('bannerText').optional().trim(),
    body('redirectUrl').optional().trim(),
    body('isActive').optional().isIn([0, 1, '0', '1'])
  ],
  asyncHandler(createHomepageBanner)
);

router.put(
  '/homepage-banners/:bannerId',
  upload.single('image'),
  [
    body('bannerText').optional().trim(),
    body('redirectUrl').optional().trim(),
    body('isActive').optional().isIn([0, 1, '0', '1'])
  ],
  asyncHandler(updateHomepageBanner)
);

router.delete('/homepage-banners/:bannerId', asyncHandler(deleteHomepageBanner));

  // App Config (Branding/Assets)
  router.get('/app-config', asyncHandler(getAppConfig));
  router.put(
    '/app-config/:key',
    [body('value').optional().trim()],
    asyncHandler(setAppConfigValue)
  );
  router.put('/app-config/:key/image', upload.single('image'), asyncHandler(setAppConfigImage));



router.get('/dashboard', asyncHandler(getAdminDashboard));

router.get('/users', asyncHandler(getAllUsers));

router.get('/vendors', asyncHandler(getAllVendors));

router.get('/vendors/:vendorId/bank-details', asyncHandler(getVendorBankDetails));
router.post(
  '/vendors',
  [
    body('vendorName').trim().notEmpty().withMessage('Vendor name is required'),
    body('phone').trim().matches(/^[0-9]{10}$/).withMessage('Valid 10-digit phone number required'),
    body('email').optional().isEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('address').optional().trim(),
    body('pincode').optional().trim()
  ],
  asyncHandler(createVendor)
);

router.put(
  '/vendors/:vendorId/status',
  [body('status').isIn([0, 1, '0', '1']).withMessage('Status must be 0 or 1')],
  asyncHandler(updateVendorStatus)
);

router.get('/orders', asyncHandler(getAllOrders));

router.get('/payments', asyncHandler(getPaymentTransactions));

router.post(
  '/payouts',
  [
    body('vendorId').isInt().withMessage('Valid vendor ID required'),
    body('amount').isFloat({ min: 0 }).withMessage('Valid amount required'),
    body('remarks').optional().trim()
  ],
  asyncHandler(processVendorPayout)
);

router.get('/payment-screenshots', asyncHandler(getPaymentScreenshots));

router.put(
  '/payment-screenshots/:screenshotId/verify',
  [
    body('status').isIn(['verified', 'rejected']).withMessage('Status must be verified or rejected'),
    body('remarks').optional().trim()
  ],
  asyncHandler(verifyPaymentScreenshot)
);

router.get('/logs/activity', asyncHandler(getActivityLogs));
router.get('/logs/errors', asyncHandler(getErrorLogs));
router.get('/logs/api', asyncHandler(getAPILogs));

router.put(
  '/settings/delivery',
  [
    body('baseCharge').isFloat({ min: 0 }).withMessage('Valid base charge required'),
    body('freeDistanceKm').isFloat({ min: 0 }).withMessage('Valid free distance required'),
    body('extraChargePerKm').isFloat({ min: 0 }).withMessage('Valid extra charge required')
  ],
  asyncHandler(updateDeliverySettings)
);

router.post(
  '/coupons',
  [
    body('code').trim().notEmpty().withMessage('Coupon code is required'),
    body('description').optional().trim(),
    body('discountType').isIn(['percentage', 'flat']).withMessage('Discount type must be percentage or flat'),
    body('discountValue').isFloat({ min: 0 }).withMessage('Valid discount value required'),
    body('minOrderAmount').optional().isFloat({ min: 0 }),
    body('startDate').isDate().withMessage('Valid start date required'),
    body('endDate').isDate().withMessage('Valid end date required'),
    body('usageLimit').optional().isInt({ min: 0 })
  ],
  asyncHandler(createCoupon)
);

export default router;
