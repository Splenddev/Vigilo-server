import cron from 'node-cron';
import Attendance from '../models/attendance.model.js';
import Group from '../models/group.js';
import { sendNotification } from '../utils/sendNotification.js';

export const startAttendanceFinalizer = (io) => {
  cron.schedule('0 23 15 * *', async () => {
    console.log('🕒 Finalizing past attendance sessions...');

    const now = new Date();

    try {
      const sessions = await Attendance.find({
        status: 'active',
        classDate: { $lt: now.toISOString().split('T')[0] }, // Only past sessions
      });

      for (const session of sessions) {
        let absents = 0;
        let pleas = 0;

        // Update student records
        session.studentRecords = session.studentRecords.map((s) => {
          if (!s.status || s.status === 'absent') {
            absents++;
            s.status = 'absent';
          }
          if (s.plea?.status === 'pending' || s.plea?.reasons?.length > 0) {
            pleas++;
          }
          return s;
        });

        // Recalculate stats
        const stats = {
          totalPresent: session.studentRecords.filter(
            (s) => s.status !== 'absent'
          ).length,
          onTime: session.studentRecords.filter((s) => s.status === 'on_time')
            .length,
          late: session.studentRecords.filter((s) => s.status === 'late')
            .length,
          leftEarly: session.studentRecords.filter(
            (s) => s.status === 'left_early'
          ).length,
          absent: absents,
          withPlea: pleas,
        };

        session.summaryStats = stats;
        session.status = 'closed';

        await session.save();

        // ─── Notify Class Rep ───
        const group = await Group.findById(session.groupId);
        const classRepId = group?.classRep;

        if (classRepId && io) {
          await sendNotification({
            type: 'info',
            message: `Session for ${session.classDate} has been finalized. ${absents} absent, ${stats.totalPresent} marked present.`,
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
