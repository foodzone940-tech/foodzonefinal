import { query } from '../config/database.js';

export const errorHandler = async (err, req, res, next) => {
  console.error('Error:', err);

  try {
    await query(
      `INSERT INTO error_logs (error_message, file_name, line_number, request_url, ip_address)
       VALUES (?, ?, ?, ?, ?)`,
      [
        err.message || 'Unknown error',
        err.stack?.split('\n')[1]?.trim() || 'unknown',
        0,
        req.originalUrl,
        req.ip
      ]
    );
  } catch (logError) {
    console.error('Failed to log error:', logError);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
};

export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
