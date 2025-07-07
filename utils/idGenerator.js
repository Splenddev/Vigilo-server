export const generateAttendanceId = (groupId, classDate, counter) => {
  if (!groupId || !classDate || typeof counter !== 'number') {
    throw new Error('groupId, classDate, and counter are required.');
  }

  const dateCode = classDate.replace(/-/g, '');
  const groupSuffix = groupId.toString().slice(-5).toLowerCase();
  const paddedCounter = String(counter).padStart(3, '0');

  return `attn_${dateCode}_${groupSuffix}_${paddedCounter}`;
};
