// routes/userRoutes.js
import express from 'express';
import {
  login,
  register,
  sendOtp,
  verifyOtp,
} from '../controllers/authControllers.js';
import upload from '../middlewares/upload.js';

const authRouter = express.Router();

authRouter.post('/register', upload.single('profilePicture'), register);
authRouter.post('/login', login);
authRouter.post('/send-otp', sendOtp);
authRouter.post('/verify-otp', verifyOtp);

export default authRouter;
