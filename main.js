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
import scheduleRoutes from './routes/schedule.routes.js';
import { errorHandler } from './middlewares/errorHandler.js';

dotenv.config();
const app = express();
await connectDB();

app.use(
  cors({
    origin: ['http://localhost:5173', 'https://vigilo.onrender.com'],
    credentials: true,
  })
);

app.use(cookieParser());
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
); // 🛡️ Secure headers
app.use(express.json());
app.use(morgan('dev'));

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // Max 5 attempts per email
  keyGenerator: (req, res) => {
    return req.body?.email || req.ip; // Use email if available, fallback to IP
  },
  message: (req, res) => ({
    success: false,
    message: `You've made too many attempts using this ${
      req.body?.email ? 'email' : 'device'
    }. Please wait 10 minutes before trying again. This helps us prevent spam and protect your account.`,
  }),
  standardHeaders: true, // Adds `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers (recommended)
});
app.use('/app/auth/login', authLimiter);
app.use('/app/auth/send-otp', authLimiter);

// Routes
app.use('/app/auth', userRoutes);
app.use('/app/groups', groupRoutes);
app.use('/app/schedule', scheduleRoutes);

app.get('/', (req, res) => {
  res.send('API is live 🌐');
});

app.use(errorHandler); // 🔥 global error handler

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
