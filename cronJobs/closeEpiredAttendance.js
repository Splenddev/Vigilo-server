import { parse, isAfter } from 'date-fns';
import Attendance from '../models/attendance.model.js';
import cron from 'node-cron';

export const closeExpiredAttendances = (io) => {
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    console.log('🕒 [closeExpiredAttendances] Running scheduled task...');

    try {
      // 1. Close regular expired sessions
      const activeSessions = await Attendance.find({
        status: 'active',
        autoEnd: true,
        attendanceType: 'physical',
        reopened: { $ne: true },
        'classTime.end': { $exists: true, $ne: null },
      });

      const expiredUpdates = [];
      const expiredIds = [];

      for (const session of activeSessions) {
        const endDateTime = parse(
          `${session.classDate} ${session.classTime.end}`,
          'yyyy-MM-dd HH:mm',
          new Date()
        );

        if (isAfter(now, endDateTime)) {
          expiredUpdates.push({
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
          expiredIds.push(session._id.toString());
        }
      }

      // 2. Close reopened sessions whose reopenedUntil has passed
      const reopenedSessions = await Attendance.find({
        status: 'active',
        reopened: true,
        reopenedUntil: { $ne: null, $lte: now },
      });

      const reopenedUpdates = [];
      const reopenedIds = [];

      for (const session of reopenedSessions) {
        reopenedUpdates.push({
          updateOne: {
            filter: { _id: session._id },
            update: {
              $set: {
                status: 'closed',
                reopened: false,
                reopenedUntil: null,
              },
            },
          },
        });
        reopenedIds.push(session._id.toString());
      }

      const allUpdates = [...expiredUpdates, ...reopenedUpdates];
      const totalClosed = allUpdates.length;

      if (totalClosed > 0) {
        await Attendance.bulkWrite(allUpdates);
        console.log(
          `[${now.toISOString()}] ✅ Closed ${totalClosed} session(s) [${expiredIds.length} expired, ${reopenedIds.length} reopened].`
        );

        const allClosedSessions = [...activeSessions, ...reopenedSessions];
        for (const session of allClosedSessions) {
          const id = session._id.toString();
          if (expiredIds.includes(id) || reopenedIds.includes(id)) {
            const room = `group:${session.groupId}`;
            io.to(room).emit('attendance:closed', {
              attendanceId: session._id,
              closedAt: now.toISOString(),
              reason: reopenedIds.includes(id)
                ? 'reopened-ended'
                : 'time-expired',
            });
          }
        }
      } else {
        console.log(
          `[${now.toISOString()}] ℹ️ No sessions to close this minute.`
        );
      }
    } catch (err) {
      console.error('❌ Error in closeExpiredAttendances:', err.message || err);
    }
  });
};
