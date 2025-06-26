import express from 'express';
import { protect } from '../middlewares/auth.js';
import { allowClassRepsOnly } from '../middlewares/role.middleware.js';
import { createSchedule } from '../controllers/schedule.controller.js';

const scheduleRoutes = express.Router();

// POST /api/schedules — Create a new schedule
scheduleRoutes.use(protect);
scheduleRoutes.post('/create', allowClassRepsOnly, createSchedule);
// scheduleRoutes.get('/find/:scheduleId', findGroupById);
// scheduleRoutes.get('/search', searchGroup);
// scheduleRoutes.post('/:scheduleId/join', joinGroup);
// scheduleRoutes.delete('/:scheduleId/join', cancelJoinRequest);
// scheduleRoutes.patch('/:scheduleId/approve-request/:studentId', approveJoinRequest);
// scheduleRoutes.patch('/:scheduleId/reject-request/:studentId', rejectJoinRequest);

export default scheduleRoutes;
