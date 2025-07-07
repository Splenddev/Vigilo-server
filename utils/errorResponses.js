export const errorResponse = (res, code, message, status = 400) => {
  return res.status(status).json({
    success: false,
    code,
    message,
  });
};
