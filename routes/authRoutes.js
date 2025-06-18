// routes/userRoutes.js
import express from 'express';
import {
  getCurrentUser,
  login,
  logoutUser,
  register,
  sendOtp,
  verifyOtp,
} from '../controllers/authControllers.js';
import upload from '../middlewares/upload.js';
import { protect } from '../middlewares/auth.js';

const authRouter = express.Router();

authRouter.post('/register', upload.single('profilePicture'), register);
authRouter.post('/login', login);
authRouter.post('/logout', logoutUser);
authRouter.post('/send-otp', sendOtp);
authRouter.post('/verify-otp', verifyOtp);
authRouter.get('/me', protect, getCurrentUser);

export default authRouter;
