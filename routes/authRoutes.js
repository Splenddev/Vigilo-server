// routes/userRoutes.js
import express from 'express';
import { login, register } from '../controllers/authControllers.js';
import upload from '../middlewares/upload.js';

const authRouter = express.Router();

authRouter.post('/register', upload.single('profilePicture'), register);
authRouter.post('/login', login);

export default authRouter;
