import express from 'express';
import { body } from 'express-validator';
import {
  userRegister,
  userLogin,
  userLoginWithOTP,
  verifyUserOTP,
  vendorLogin,
  vendorLoginWithOTP,
  verifyVendorOTP,
  adminLogin,
  refreshAccessToken
} from '../controllers/authController.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { loginLimiter, otpLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post(
  '/user/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('phone').trim().matches(/^[0-9]{10}$/).withMessage('Valid 10-digit phone number required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  asyncHandler(userRegister)
);

router.post(
  '/user/login',
  loginLimiter,
  [
    body('phone').trim().matches(/^[0-9]{10}$/).withMessage('Valid phone number required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  asyncHandler(userLogin)
);

router.post(
  '/user/login-otp',
  otpLimiter,
  [
    body('phone').trim().matches(/^[0-9]{10}$/).withMessage('Valid phone number required')
  ],
  asyncHandler(userLoginWithOTP)
);

router.post(
  '/user/verify-otp',
  [
    body('userId').isInt().withMessage('Valid user ID required'),
    body('otp').trim().isLength({ min: 6, max: 6 }).withMessage('Valid 6-digit OTP required')
  ],
  asyncHandler(verifyUserOTP)
);

router.post(
  '/vendor/login',
  loginLimiter,
  [
    body('phone').trim().matches(/^[0-9]{10}$/).withMessage('Valid phone number required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  asyncHandler(vendorLogin)
);

router.post(
  '/vendor/login-otp',
  otpLimiter,
  [
    body('phone').trim().matches(/^[0-9]{10}$/).withMessage('Valid phone number required')
  ],
  asyncHandler(vendorLoginWithOTP)
);

router.post(
  '/vendor/verify-otp',
  [
    body('vendorId').isInt().withMessage('Valid vendor ID required'),
    body('otp').trim().isLength({ min: 6, max: 6 }).withMessage('Valid 6-digit OTP required')
  ],
  asyncHandler(verifyVendorOTP)
);

router.post(
  '/admin/login',
  loginLimiter,
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  asyncHandler(adminLogin)
);

router.post(
  '/refresh-token',
  [body('refreshToken').notEmpty().withMessage('Refresh token required')],
  asyncHandler(refreshAccessToken)
);

export default router;
