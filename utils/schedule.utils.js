import createHttpError from 'http-errors';
import scheduleModel from '../models/schedule.model.js';

export const toMinutes = (hhmm) => {
  const [hh, mm] = hhmm.split(':').map(Number);
  return hh * 60 + mm;
};

// Simple range intersection test
export const rangesOverlap = (aStart, aEnd, bStart, bEnd) =>
  aStart < bEnd && bStart < aEnd;

// Convert “Yes”/“No”, numeric strings, etc.
export const normalisePayload = (raw) => {
  const yesNoToBool = (v) =>
    typeof v === 'string' ? v.toLowerCase() === 'yes' : !!v;

  return {
    ...raw,
    allowAttendanceMarking: yesNoToBool(raw.allowAttendanceMarking),
    isActive: yesNoToBool(raw.isActive),
    autoEnd: yesNoToBool(raw.autoEnd),
    allowMediaUploads: yesNoToBool(raw.allowMediaUploads),
    mediaNeedsApproval: yesNoToBool(raw.mediaNeedsApproval),
    notificationLeadTime:
      typeof raw.notificationLeadTime === 'string'
        ? Number(raw.notificationLeadTime) || 0
        : raw.notificationLeadTime,
    courseUnit:
      typeof raw.courseUnit === 'string'
        ? raw.courseUnit.trim()
        : raw.courseUnit,
  };
};

// Validates classType / location consistency
export const validateClassType = ({
  classType,
  virtualLink,
  classLocation,
}) => {
  if (classType === 'Virtual' && !virtualLink)
    throw createHttpError(400, 'Virtual classes must include a meeting link.');

  if (classType === 'Physical' && !classLocation)
    throw createHttpError(
      400,
      'Physical classes must include a class location.'
    );
};

// Checks notificationLeadTime ≤ shortest duration
export const validateLeadTime = ({ classDaysTimes, notificationLeadTime }) => {
  const minDuration = Math.min(
    ...classDaysTimes.map(({ timing }) => {
      const dur = toMinutes(timing.endTime) - toMinutes(timing.startTime);
      return dur;
    })
  );

  if (notificationLeadTime > minDuration) {
    throw createHttpError(
      400,
      `Notification lead time (${notificationLeadTime} min) cannot exceed the shortest class duration (${minDuration} min).`
    );
  }
};

// Detect same-day overlaps inside DB
export const detectConflicts = async ({ groupId, classDaysTimes }) => {
  // Query once per unique day → parallel
  const uniqueDays = [...new Set(classDaysTimes.map((d) => d.day))];

  const conflicts = await Promise.all(
    uniqueDays.map((day) =>
      scheduleModel
        .find({
          groupId,
          isActive: true,
          'classDaysTimes.day': day,
        })
        .lean()
    )
  );

  // Flatten results
  const schedules = conflicts.flat();

  // Iterate over payload slots and compare
  for (const { day, timing } of classDaysTimes) {
    const start = toMinutes(timing.startTime);
    const end = toMinutes(timing.endTime);

    for (const existing of schedules) {
      const sameDayTimes = existing.classDaysTimes.filter((t) => t.day === day);
      for (const t of sameDayTimes) {
        if (
          rangesOverlap(
            start,
            end,
            toMinutes(t.timing.startTime),
            toMinutes(t.timing.endTime)
          )
        ) {
          throw createHttpError(
            409,
            `Conflict: "${existing.courseTitle}" already has a class on ${day} from ${t.timing.startTime} to ${t.timing.endTime}.`
          );
        }
      }
    }
  }
};
