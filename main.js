import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import http from 'http';

import connectDB from './config/db.js';
import { initSocket } from './socket/socket.js';
import { startCronJobs } from './cronJobs/index.js'; // ✅ NEW

// Routes
import userRoutes from './routes/authRoutes.js';
import groupRoutes from './routes/group.routes.js';
import scheduleRoutes from './routes/schedule.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import courseRouter from './routes/course.routes.js';
import notificationRouter from './routes/notifications.routes.js';

import { errorHandler } from './middlewares/errorHandler.js';
import validatorRouter from './routes/validators.routes.js';
import scheduleInstance from './routes/scheduleInstance.route.js';

dotenv.config();
const app = express();
await connectDB();

const server = http.createServer(app);

// ✅ Initialize Socket.IO
const io = initSocket(server);

// ✅ Attach io to requests
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ✅ Global Middlewares
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'https://vigilo.onrender.com',
      'https://vigilo.vercel.app',
    ],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(express.json());
app.use(morgan('dev'));

// ✅ Rate Limiting
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.body?.email || req.ip,
  message: () => ({
    success: false,
    message: `You've made too many attempts using this ${
      req.body?.email ? 'email' : 'device'
    }. Please wait 10 minutes before trying again.`,
  }),
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/app/auth/login', authLimiter);
app.use('/app/auth/send-otp', authLimiter);

// ✅ Routes
app.use('/app/auth', userRoutes);
app.use('/app/groups', groupRoutes);
app.use('/app/schedule', scheduleRoutes);
app.use('/app/schedule-instance', scheduleInstance);
app.use('/app/attendance', attendanceRoutes);
app.use('/app/courses', courseRouter);
app.use('/app/validate', validatorRouter);
app.use('/app/notifications', notificationRouter);

// ✅ Start all cron jobs
startCronJobs(io);

// ✅ Health Check
app.get('/', (req, res) => {
  res.send('API is live 🌐');
});

// ✅ Error Handler
app.use(errorHandler);

// ✅ Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`🚀 Server and Socket.IO running on http://localhost:${PORT}`)
);
