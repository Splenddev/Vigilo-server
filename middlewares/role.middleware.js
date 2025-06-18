export const allowClassRepsOnly = (req, res, next) => {
  if (req.user.role !== 'class-rep') {
    return res
      
      
      .status(403)
      .json({ error: 'Only class reps can perform this action' });
  }
  next();
};
