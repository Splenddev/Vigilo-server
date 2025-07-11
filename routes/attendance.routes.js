import express from 'express';
import { protect } from '../middlewares/auth.js';
import { allowClassRepsOnly } from '../middlewares/role.middleware.js';
import {
  createAttendance,
  getGroupAttendances,
  getGroupAttendanceTab,
  markGeoAttendanceEntry,
} from '../controllers/attendance.controller.js';

const attendanceRoutes = express.Router();

attendanceRoutes.use(protect);

attendanceRoutes.post('/create', allowClassRepsOnly, createAttendance);
attendanceRoutes.get('/groups/:groupId/', getGroupAttendances);
attendanceRoutes.get('/group-tab/:groupId/', getGroupAttendanceTab);
attendanceRoutes.post('/mark-entry/:attendanceId', markGeoAttendanceEntry);

export default attendanceRoutes;
