import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import connectDB from './config/db.js';
import userRoutes from './routes/authRoutes.js';
import groupRoutes from './routes/group.routes.js';

dotenv.config();
const app = express();
connectDB();

app.use(
  cors({
    origin: ['http://localhost:5173', 'https://vigilo.onrender.com'],
    credentials: true,
  })
);

app.use(helmet()); // 🛡️ Secure headers
app.use(express.json());
app.use(morgan('dev'));
app.use(cookieParser());

// ⏱️ Rate limit auth routes
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many attempts. Please try again later.',
  },
});
app.use('/app/auth/login', authLimiter);
app.use('/app/auth/send-otp', authLimiter);

// Routes
app.use('/app/auth', userRoutes);
app.use('/app/groups', groupRoutes);

app.get('/', (req, res) => {
  res.send('API is live 🌐');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
