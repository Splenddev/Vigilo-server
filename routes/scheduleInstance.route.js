import express from 'express';
import { protect } from '../middlewares/auth.js';
import {
  getScheduleInstanceById,
  getTodayInstances,
} from '../controllers/scheduleInstance.js';
import { allowClassRepsOnly } from '../middlewares/role.middleware.js';

const scheduleInstance = express.Router();

// 🔐 All schedule routes require auth
scheduleInstance.use(protect);

scheduleInstance.get('/:scheduleId', getScheduleInstanceById);
scheduleInstance.get('/rep/today', allowClassRepsOnly, getTodayInstances);

export default scheduleInstance;
