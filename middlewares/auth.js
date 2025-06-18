import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';

export const protect = async (req, res, next) => {
  try {
    const token = req.cookies?.token;
    // 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4NDc2MzNhN2RiYzg2MzJlYTQ5MDE0ZCIsImlhdCI6MTc1MDI4Mzg3MiwiZXhwIjoxNzUwODg4NjcyfQ.a5Ul5DDmBURC7dUjwgd1gPIrx8_l39xKQM2bNEL4krA';

    if (!token) {
      return res
        .status(401)
        .json({ error: 'Not authorized, no token in cookies' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(401).json({ error: 'Token invalid or expired' });
  }
};
