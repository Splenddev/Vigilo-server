export const emitAttendanceProgress = (io, attendance, studentRecord) => {
  io.to(attendance.groupId.toString()).emit('attendance:progress', {
    attendanceId: attendance._id,
    studentId: studentRecord.studentId,
    studentName: studentRecord.name,
    status: studentRecord.status,
    summaryStats: attendance.summaryStats,
  });
};
