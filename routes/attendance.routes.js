import express from 'express';
import { protect } from '../middlewares/auth.js';
import { allowClassRepsOnly } from '../middlewares/role.middleware.js';
import {
  createAttendance,
  getGroupAttendances,
} from '../controllers/attendance.controller.js';

const attendanceRoutes = express.Router();

attendanceRoutes.use(protect);

attendanceRoutes.post('/create', allowClassRepsOnly, createAttendance);
attendanceRoutes.get('/groups/:groupId/', getGroupAttendances);

export default attendanceRoutes;
