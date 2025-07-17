import { applyTimeOffset } from '../../../utils/helpers.js';

export const getEntryWindows = (attendance) => {
  const classStart = new Date(
    `${attendance.classDate}T${attendance.classTime.start}`
  );
  const classEnd = new Date(
    `${attendance.classDate}T${attendance.classTime.end}`
  );

  const entryStart = applyTimeOffset(
    classStart,
    attendance.entry?.start || '0H0M'
  );
  const entryEnd = applyTimeOffset(
    classStart,
    attendance.entry?.end || '1H30M'
  );

  return { classStart, classEnd, entryStart, entryEnd };
};
