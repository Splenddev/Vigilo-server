import jwt from 'jsonwebtoken';

export const createToken = async (id, res) => {
  const token = jwt.sign({ id }, process.env.JWT_SECRET_KEY, {
    expiresIn: '7d',
  });

  const isProd = process.env.NODE_ENV === 'production';

  res.cookie('token', token, {
    httpOnly: true,
    secure: isProd, // Only true in production
    sameSite: isProd ? 'none' : 'lax', // 'none' allows cross-site cookies
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return token;
};
