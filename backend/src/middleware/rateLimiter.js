import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.OTP_RATE_LIMIT_MAX) || 3,
  message: { success: false, message: 'Too many OTP requests. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many payment requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});
