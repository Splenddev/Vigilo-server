import { startAttendanceActivator } from './attendanceActivator.js';
import { startAttendanceFinalizer } from './attendanceFinalizer.js';

export const startCronJobs = (io) => {
  console.log('📅 Starting all cron jobs...');
  startAttendanceFinalizer(io);
  startAttendanceActivator(io);
};
