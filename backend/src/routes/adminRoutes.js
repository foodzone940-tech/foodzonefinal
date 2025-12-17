import express from 'express';
import { body } from 'express-validator';
import {
  getAdminDashboard,
  getAllUsers,
  getAllVendors,
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
  createCoupon
} from '../controllers/adminController.js';
import { adminAuthMiddleware } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

router.use(adminAuthMiddleware);

router.get('/dashboard', asyncHandler(getAdminDashboard));

router.get('/users', asyncHandler(getAllUsers));

router.get('/vendors', asyncHandler(getAllVendors));

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
