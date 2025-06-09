import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import connectDB from './config/db.js';
import userRoutes from './routes/authRoutes.js';
import cookieParser from 'cookie-parser';

dotenv.config();
const app = express();

// Connect to DB
connectDB();

// Middleware
app.use(
  cors({
    origin: ['http://localhost:5173', 'https://vigilo.onrender.com'],
    credentials: true,
  })
);

app.use(express.json());
app.use(morgan('dev'));
app.use(cookieParser());

// Routes
app.use('/app/auth', userRoutes);
// app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
  res.send('API is live 🌐');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
