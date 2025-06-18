export const allowClassRepsOnly = (req, res, next) => {
  if (req.user?.role !== 'classRep') {
    return res.status(403).json({
      error: 'Access denied. Only Class Reps can perform this action.',
    });
  }
  next();
};
