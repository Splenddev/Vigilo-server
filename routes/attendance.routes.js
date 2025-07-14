import express from 'express';
import { protect } from '../middlewares/auth.js';
import { allowClassRepsOnly } from '../middlewares/role.middleware.js';
import {
  createAttendance,
  deleteAttendance,
  finalizeSingleAttendance,
  getGroupAttendances,
  getGroupAttendanceTab,
  markGeoAttendanceEntry,
  reopenAttendanceSession,
} from '../controllers/attendance.controller.js';

const attendanceRoutes = express.Router();

attendanceRoutes.use(protect);

attendanceRoutes.post('/create', allowClassRepsOnly, createAttendance);
attendanceRoutes.get('/groups/:groupId/', getGroupAttendances);
attendanceRoutes.get('/group-tab/:groupId/', getGroupAttendanceTab);
attendanceRoutes.post('/mark-entry/:attendanceId', markGeoAttendanceEntry);
attendanceRoutes.post(
  '/finalize/:attendanceId',
  allowClassRepsOnly,
  finalizeSingleAttendance
);
attendanceRoutes.post(
  '/re-open/:attendanceId',
  allowClassRepsOnly,
  reopenAttendanceSession
);
attendanceRoutes.delete('/:attendanceId', allowClassRepsOnly, deleteAttendance);

export default attendanceRoutes;
