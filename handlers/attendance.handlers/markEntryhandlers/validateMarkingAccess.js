import createHttpError from 'http-errors';

export const validateMarkingAccess = ({ attendance, studentRecord }) => {
  if (!attendance) {
    throw createHttpError(404, 'Attendance session not found.', {
      code: 'ATTENDANCE_NOT_FOUND',
    });
  }
  if (attendance.status !== 'active') {
    throw createHttpError(403, 'Attendance is closed.', {
      code: 'ATTENDANCE_CLOSED',
    });
  }
  if (!studentRecord) {
    throw createHttpError(403, 'You are not allowed to mark this attendance.', {
      code: 'NOT_ALLOWED_TO_MARK',
    });
  }
};
