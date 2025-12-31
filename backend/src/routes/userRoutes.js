import express from 'express';
import { body } from 'express-validator';
import { getProfile, updateProfile } from '../controllers/userController.js';
import { authMiddleware } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/profile', asyncHandler(getProfile));

router.put(
  '/profile',
  [
    body('name').optional().trim(),
    body('email').optional().isEmail().withMessage('Valid email required'),
    body('address').optional().trim(),
    body('pincode').optional().trim()
  ],
  asyncHandler(updateProfile)
);

export default router;
