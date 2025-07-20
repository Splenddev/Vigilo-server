import { parse, isAfter } from 'date-fns';
import Attendance from '../models/attendance.model.js';
import cron from 'node-cron';

/**
 * Closes attendance sessions that are still "active" but have passed their end time.
 */
export const closeExpiredAttendances = (io) => {
  cron.schedule('* * * * *', async () => {
    console.log('🕒 Checking for expired attendances to close...');

    try {
      const now = new Date();

      // Fetch all active sessions with autoEnd enabled
      const sessions = await Attendance.find({
        status: 'active',
        // autoEnd: true,attendanceType:'physical'
      });

      console.log(sessions);

      const updates = [];

      for (const session of sessions) {
        const { classDate, classTime } = session;

        // Defensive check
        if (!classTime?.end) continue;

        // Build datetime from classDate and classTime.end (e.g., "2025-07-19 14:00")
        const endDateTime = parse(
          `${classDate} ${classTime.end}`,
          'yyyy-MM-dd HH:mm',
          new Date()
        );

        if (isAfter(now, endDateTime)) {
          updates.push({
            updateOne: {
              filter: { _id: session._id },
              update: {
                $set: {
                  status: 'closed',
                  'settings.notifyOnStart': false,
                },
              },
            },
          });
        }
      }

      if (updates.length > 0) {
        await Attendance.bulkWrite(updates);
        console.log(
          `[${now.toISOString()}] ✅ Auto-closed ${updates.length} expired attendance sessions.`
        );

        // Optionally emit socket event to affected group rooms
        for (const session of sessions) {
          const room = `group:${session.groupId}`;
          io.to(room).emit('attendance:closed', { attendanceId: session._id });
        }
      } else {
        console.log(
          `[${now.toISOString()}] ℹ️ No expired attendance sessions to close.`
        );
      }
    } catch (err) {
      console.error('❌ Error in closeExpiredAttendances:', err);
    }
  });
};
