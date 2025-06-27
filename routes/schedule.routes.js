import express from 'express';
import { protect } from '../middlewares/auth.js';
import { allowClassRepsOnly } from '../middlewares/role.middleware.js';
import {
  createSchedule,
  getSchedulesByGroup,
} from '../controllers/schedule.controller.js';

const scheduleRoutes = express.Router();

// 🔐 All schedule routes require auth
scheduleRoutes.use(protect);

// POST /app/schedule/create — Create new schedule (Class Reps only)
scheduleRoutes.post('/create', allowClassRepsOnly, createSchedule);

// GET /app/schedule/:groupId — Fetch schedules for a group
scheduleRoutes.get('/:groupId', getSchedulesByGroup);

// Future routes
// scheduleRoutes.get('/find/:scheduleId', findGroupById);
// scheduleRoutes.get('/search', searchGroup);
// scheduleRoutes.post('/:scheduleId/join', joinGroup);
// scheduleRoutes.delete('/:scheduleId/join', cancelJoinRequest);
// scheduleRoutes.patch('/:scheduleId/approve-request/:studentId', approveJoinRequest);
// scheduleRoutes.patch('/:scheduleId/reject-request/:studentId', rejectJoinRequest);

export default scheduleRoutes;
