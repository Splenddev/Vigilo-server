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
  const response = {
    success: false,
    code: err.code || 'INTERNAL_ERROR',
    message: err.message || 'Something went wrong.',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  };

  for (const key in err) {
    if (!(key in response)) {
      response[key] = err[key];
    }
  }

  res.status(statusCode).json(response);
};
