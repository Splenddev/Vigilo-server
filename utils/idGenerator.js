import Attendance from '../models/attendance.model.js'; // or wherever it is

export const generateAttendanceId = async (groupId, classDate) => {
  if (!groupId || !classDate) {
    throw new Error('groupId and classDate are required.');
  }

  const dateCode = classDate.replace(/-/g, '');
  const groupSuffix = groupId.toString().slice(-5).toLowerCase();
  const basePrefix = `attn_${dateCode}_${groupSuffix}`;

  // 1. Find the latest attendanceId that starts with the prefix
  const latest = await Attendance.findOne({
    attendanceId: { $regex: `^${basePrefix}_\\d{3}$` },
  }).sort({ attendanceId: -1 });

  // 2. Extract last counter and increment
  let counter = 1;
  if (latest) {
    const match = latest.attendanceId.match(/_(\d{3})$/);
    if (match) {
      counter = parseInt(match[1], 10) + 1;
    }
  }

  const paddedCounter = String(counter).padStart(3, '0');
  return `${basePrefix}_${paddedCounter}`;
};
