import express from 'express';
import { protect } from '../middlewares/auth.js';
import { getScheduleInstanceById } from '../controllers/scheduleInstance.js';

const scheduleInstance = express.Router();

// 🔐 All schedule routes require auth
scheduleInstance.use(protect);

scheduleInstance.get('/:scheduleId', getScheduleInstanceById);

export default scheduleInstance;
