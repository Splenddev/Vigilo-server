import cron from 'node-cron';
import Attendance from '../models/attendance.model.js';
import Group from '../models/group.js';
import { sendNotification } from '../utils/sendNotification.js';

export const startAttendanceFinalizer = (io) => {
  cron.schedule('0 23 * * *', async () => {
    console.log('🕒 Finalizing past attendance sessions...');

    const todayISO = new Date().toISOString().split('T')[0];

    try {
      const sessions = await Attendance.find({
        status: 'active',
        classDate: { $lt: todayISO },
        autoEnd: true,
      }).populate('studentRecords');
      console.log(sessions);
      for (const session of sessions) {
        const studentRecords = session.studentRecords || [];

        // 🛡️ Fallback: If no studentRecords found, mark all absent
        if (studentRecords.length === 0) {
          console.warn(
            `⚠️ No student records found for attendanceId: ${session._id}`
          );
          session.summaryStats = {
            totalPresent: 0,
            onTime: 0,
            late: 0,
            leftEarly: 0,
            absent: 0,
            withPlea: 0,
          };
          session.status = 'closed';
          await session.save();
          continue;
        }

        let absents = 0;
        let pleas = 0;

        // Update each student record
        for (const record of studentRecords) {
          if (!record.status || record.status === 'absent') {
            absents++;
            record.status = 'absent';
            await record.save();
          }

          if (
            record.plea?.status === 'pending' ||
            (record.plea?.reasons?.length ?? 0) > 0
          ) {
            pleas++;
          }
        }

        // Recalculate and update stats
        const stats = {
          totalPresent: studentRecords.filter((s) => s.status !== 'absent')
            .length,
          onTime: studentRecords.filter((s) => s.status === 'on_time').length,
          late: studentRecords.filter((s) => s.status === 'late').length,
          leftEarly: studentRecords.filter((s) => s.status === 'left_early')
            .length,
          absent: absents,
          withPlea: pleas,
        };

        session.summaryStats = stats;
        session.status = 'closed';

        await session.save();

        // Notify Class Rep
        const group = await Group.findById(session.groupId);
        const classRepId = group?.classRep;

        if (classRepId && io) {
          await sendNotification({
            type: 'info',
            message: `✅ Attendance for ${session.courseCode} on ${session.classDate} finalized. ${stats.totalPresent} present, ${absents} absent.`,
            forUser: classRepId,
            relatedId: session._id,
            relatedType: 'attendance',
            groupId: session.groupId,
            io,
          });
        }
      }

      console.log(`✅ Finalized ${sessions.length} session(s).`);
    } catch (err) {
      console.error('❌ Error finalizing attendance:', err.message);
    }
  });
};
