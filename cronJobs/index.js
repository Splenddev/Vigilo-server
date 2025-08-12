import { startAttendanceActivator } from './attendanceActivator.js';
import { startAttendanceFinalizer } from './attendanceFinalizer.js';
import { closeExpiredAttendances } from './closeEpiredAttendance.js';
import { scheduleInstanceCreatorCron } from './scheduleInstanceAutoCreate.js';

export const startCronJobs = (io) => {
  console.log('📅 Starting all cron jobs...');
  startAttendanceFinalizer(io);
  startAttendanceActivator(io);
  closeExpiredAttendances(io);
  scheduleInstanceCreatorCron(io);
};
