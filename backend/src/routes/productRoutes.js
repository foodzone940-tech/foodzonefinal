import express from 'express';
import {
  getAllProducts,
  getProductById,
  getCategories,
  getVendors,
  getVendorById,
  addReview
} from '../controllers/productController.js';
import { authMiddleware } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

router.get('/products', asyncHandler(getAllProducts));
router.get('/products/:id', asyncHandler(getProductById));
router.get('/categories', asyncHandler(getCategories));
router.get('/vendors', asyncHandler(getVendors));
router.get('/vendors/:id', asyncHandler(getVendorById));
router.post('/products/:productId/review', authMiddleware, asyncHandler(addReview));

export default router;
