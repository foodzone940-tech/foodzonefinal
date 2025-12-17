import express from 'express';
import { body } from 'express-validator';
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartSummary
} from '../controllers/cartController.js';
import { authMiddleware } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', asyncHandler(getCart));
router.get('/summary', asyncHandler(getCartSummary));

router.post(
  '/add',
  [
    body('productId').isInt().withMessage('Valid product ID required'),
    body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1')
  ],
  asyncHandler(addToCart)
);

router.put(
  '/:cartId',
  [body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1')],
  asyncHandler(updateCartItem)
);

router.delete('/:cartId', asyncHandler(removeFromCart));
router.delete('/', asyncHandler(clearCart));

export default router;
