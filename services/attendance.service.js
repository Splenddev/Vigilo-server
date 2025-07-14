import Attendance from '../models/attendance.model.js';
import Group from '../models/group.js';
import scheduleModel from '../models/schedule.model.js';

export const checkDuplicateAttendance = async ({
  scheduleId,
  courseCode,
  courseTitle,
  classDate,
  classTime,
}) => {
  return await Attendance.findOne({
    scheduleId,
    courseCode,
    courseTitle,
    classDate,
    'classTime.start': classTime.start,
  });
};

export const getGroupAndSchedule = async (groupId, scheduleId) => {
  const group = await Group.findById(groupId);
  const schedule = scheduleId ? await scheduleModel.findById(scheduleId) : null;

  return { group, schedule };
};

export const buildStudentRecords = (members) =>
  members.map((s) => ({
    studentId: s._id,
    name: s.name,
    status: 'absent',
    role: s.role,
  }));
