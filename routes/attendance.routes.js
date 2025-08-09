import express from 'express';
import { protect } from '../middlewares/auth.js';
import { allowClassRepsOnly } from '../middlewares/role.middleware.js';
import {
  createAttendance,
  finalizeSingleAttendance,
  getGroupAttendances,
  getGroupAttendanceTab,
  markGeoAttendanceEntry,
  reopenAttendanceSession,
} from '../controllers/attendance.controller.js';
import { getDetailedStudentAttendanceSummary } from '../controllers/students.controller.js';

const attendanceRoutes = express.Router();

attendanceRoutes.use(protect);

//class reps
attendanceRoutes.post('/create', allowClassRepsOnly, createAttendance);
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

//general
attendanceRoutes.get('/groups/:groupId/', getGroupAttendances);
attendanceRoutes.get('/group-tab/:groupId/', getGroupAttendanceTab);
attendanceRoutes.post('/mark-entry/:attendanceId', markGeoAttendanceEntry);

//student
attendanceRoutes.get(
  '/students/:studentId/summary',
  getDetailedStudentAttendanceSummary
);

export default attendanceRoutes;
