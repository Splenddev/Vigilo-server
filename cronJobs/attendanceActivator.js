// startAttendanceActivator.js
import cron from 'node-cron';
import { format } from 'date-fns';
import Attendance from '../models/attendance.model.js';
import Group from '../models/group.js';
import { sendNotification } from '../utils/sendNotification.js';
import { sendGroupNotification } from '../utils/notify/sendGroupNotification.js';
import StudentAttendance from '../models/student.attendance.model.js';

export const startAttendanceActivator = (io) => {
  cron.schedule('* * * * *', async () => {
    console.log('🕒 Checking for attendances to activate...');

    const todayISO = new Date().toISOString().split('T')[0];

    try {
      const sessions = await Attendance.find({
        status: 'upcoming',
        classDate: todayISO,
        initialized: false,
      });

      for (const session of sessions) {
        const {
          _id: attendanceId,
          groupId,
          classTime,
          courseCode,
          courseTitle,
        } = session;

        const group = await Group.findById(groupId);
        if (!group) continue;

        const members = group.members || [];

        // ✅ Insert absent records if not yet done
        const existingRecords = await StudentAttendance.find({
          attendanceId: session._id,
        });

        if (existingRecords.length === 0) {
          const absentRecords = members.map((student) => ({
            attendanceId: session._id,
            studentId: student._id,
            name: student.name,
            status: 'absent',
            role: student.role,
          }));
          await StudentAttendance.insertMany(absentRecords);
        }

        // Update session status and summary
        session.status = 'active';

        const updatedRecords = await StudentAttendance.find({
          attendanceId: session._id,
        });

        const stats = {
          totalPresent: updatedRecords.filter((s) => s.status !== 'absent')
            .length,
          onTime: updatedRecords.filter((s) => s.status === 'on_time').length,
          late: updatedRecords.filter((s) => s.status === 'late').length,
          leftEarly: updatedRecords.filter((s) => s.status === 'left_early')
            .length,
          absent: updatedRecords.filter((s) => s.status === 'absent').length,
          withPlea: updatedRecords.filter(
            (s) =>
              s.plea?.status === 'pending' || (s.plea?.reasons?.length ?? 0) > 0
          ).length,
        };

        session.status = 'active';
        session.initialized = true;
        await session.save();

        const message = `📢 Attendance for **${courseTitle || courseCode}** is now active from **${classTime?.start} to ${classTime?.end}**. Tap to check in before ${classTime?.end}.`;

        // ✅ Emit real-time socket notification
        for (const student of members) {
          io.to(student._id.toString()).emit('attendance:activated', {
            attendanceId: session._id,
            message: `📢 Your attendance for ${courseCode} is now active.`,
            classTime,
            classDate: session.classDate,
          });
        }

        // ✅ Group-wide notification
        await sendGroupNotification({
          type: 'announcement',
          message,
          targetGroupId: groupId,
          targetRole: 'student',
          fromUser: group.createdBy,
          link: `/group/${groupId}/attendance/${attendanceId}`,
          io,
        });

        // ✅ Notify class rep
        if (group?.createdBy) {
          await sendNotification({
            type: 'info',
            message: `📘 Attendance for ${courseTitle || courseCode} has been activated.`,
            forUser: group.createdBy,
            relatedId: session._id,
            relatedType: 'attendance',
            groupId,
            io,
          });
        }

        console.log(
          `✅ Activated attendance "${attendanceId}" for ${members.length} student(s)`
        );
      }

      console.log(`✅ Activated ${sessions.length} attendance session(s).`);
    } catch (err) {
      console.error('❌ Error activating attendance:', err.message);
    }
  });
};
