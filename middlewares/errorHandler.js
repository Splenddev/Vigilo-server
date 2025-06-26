export const errorHandler = (err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;

  // 🔥 Log meaningful error info to the console
  console.error('🛑 Error occurred:', {
    method: req.method,
    url: req.originalUrl,
    status: statusCode,
    message: err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });

  // 📤 Send JSON response
  res.status(statusCode).json({
    message: err.message || 'Internal Server Error',
    status: statusCode,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};
