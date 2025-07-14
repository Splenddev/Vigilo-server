export const validateCreateAttendancePayload = (body, classTime) => {
  const missing = [];
  if (!body.groupId) missing.push('groupId');
  if (!body.classDate) missing.push('classDate');
  if (!classTime?.start || !classTime?.end) missing.push('classTime');
  if (!body.location) missing.push('location');

  if (missing.length) {
    const error = new Error(`Missing required field(s): ${missing.join(', ')}`);
    error.code = 'MISSING_FIELDS';
    error.status = 400;
    throw error;
  }

  const [startHour, startMin] = classTime.start.split(':').map(Number);
  const [endHour, endMin] = classTime.end.split(':').map(Number);
  const start = new Date(0, 0, 0, startHour, startMin);
  const end = new Date(0, 0, 0, endHour, endMin);

  if (end <= start) {
    const error = new Error('Class end time must be later than start time.');
    error.code = 'INVALID_TIME_RANGE';
    error.status = 400;
    throw error;
  }

  if (
    typeof body.location.latitude !== 'number' ||
    typeof body.location.longitude !== 'number'
  ) {
    const error = new Error('Latitude and longitude must be valid numbers.');
    error.code = 'INVALID_LOCATION';
    error.status = 400;
    throw error;
  }
};
