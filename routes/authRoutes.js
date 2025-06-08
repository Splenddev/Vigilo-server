// routes/userRoutes.js
import express from 'express';
import { register } from '../controllers/authControllers.js';
import upload from '../middlewares/upload.js';

const authRouter = express.Router();

authRouter.post('/register', upload.single('profilePicture'), register);

export default authRouter;
