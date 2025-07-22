import createHttpError from 'http-errors';
import { validateGeoProximity } from './geoUtils.js';
import Group from '../models/group.js';
import { sendNotification } from './sendNotification.js';
import { applyTimeOffset } from './helpers.js';

export const getFinalStatus = ({
  checkInStatus,
  checkOutStatus,
  pleaStatus = null,
}) => {
  // 1. Plea approved overrides all other logic
  if (pleaStatus === 'approved') {
    return 'excused';
  }

  // 2. Missed both check-in and check-out
  if (checkInStatus === 'absent' && checkOutStatus === 'missed') {
    return 'absent';
  }

  // 3. Fully present
  if (checkInStatus === 'on_time' && checkOutStatus === 'on_time') {
    return 'present';
  }

  // 4. Late attendance
  if (checkInStatus === 'late' && checkOutStatus === 'on_time') {
    return 'late';
  }

  // 5. Partial attendance
  const partialConditions = [
    checkInStatus !== 'absent' && checkOutStatus === 'missed',
    checkInStatus === 'absent' && checkOutStatus !== 'missed',
    checkInStatus === 'late' && checkOutStatus === 'left_early',
    checkInStatus === 'on_time' && checkOutStatus === 'left_early',
  ];

  if (partialConditions.some(Boolean)) {
    return 'partial';
  }

  // 6. Fallback
  return 'absent';
};

export const enforceAttendanceSettings = (
  studentRecord,
  attendance,
  context
) => {
  const {
    mode, // 'checkIn' or 'checkOut'
    markTime, // in minutes (from attendance start)
    durationMinutes,
    entryStart,
    entryEnd,
    selfieProof,
    joinedAfterAttendanceCreated,
  } = context;

  const settings = attendance.settings || {};
  const errors = [];

  // ──────────────── GENERAL RULES ────────────────

  if (
    settings.proofRequirement === 'selfie' &&
    mode === 'checkIn' &&
    !selfieProof
  ) {
    errors.push({
      code: 'PROOF_REQUIRED',
      message: 'Selfie proof is mandatory for check-in but was not provided.',
    });
  }

  if (!settings.allowLateJoiners && joinedAfterAttendanceCreated) {
    errors.push({
      code: 'LATE_JOIN_BLOCKED',
      message:
        'You joined this group after the attendance session started and are not allowed to mark attendance for it.',
    });
  }

  // ──────────────── CHECK-IN RULES ────────────────

  if (mode === 'checkIn') {
    if (markTime < entryStart && !settings.allowEarlyCheckInOut) {
      errors.push({
        code: 'TOO_EARLY_CHECKIN',
        message: `Check-in attempted ${entryStart - markTime} minutes earlier than allowed. Early check-in is not permitted.`,
      });
    }

    if (markTime > entryEnd && !settings.allowLateCheckInOut) {
      errors.push({
        code: 'TOO_LATE_CHECKIN',
        message: `Check-in attempted ${markTime - entryEnd} minutes after the allowed time window. Late check-in is not permitted.`,
      });
    }
  }

  // ──────────────── CHECK-OUT RULES ────────────────

  if (mode === 'checkOut') {
    if (!settings.enableCheckInOut) {
      errors.push({
        code: 'CHECK_OUT_DISABLED',
        message:
          'This attendance session does not allow check-out. Please contact your class rep.',
      });
    }

    if (markTime < entryStart && !settings.allowEarlyCheckOut) {
      errors.push({
        code: 'TOO_EARLY_CHECKOUT',
        message: `You are attempting to check out ${entryStart - markTime} minutes earlier than the allowed time. Early check-out is not enabled.`,
      });
    }

    if (markTime > entryEnd && !settings.allowLateCheckOut) {
      errors.push({
        code: 'TOO_LATE_CHECKOUT',
        message: `You are attempting to check out ${markTime - entryEnd} minutes after the permitted time. Late check-out is not enabled.`,
      });
    }

    if (
      settings.minimumPresenceDuration &&
      durationMinutes < settings.minimumPresenceDuration
    ) {
      const formatMinutes = (min) => `${min} minute${min !== 1 ? 's' : ''}`;
      errors.push({
        code: 'SHORT_DURATION',
        message: `You stayed for ${formatMinutes(durationMinutes)}, but the minimum required presence is ${formatMinutes(settings.minimumPresenceDuration)}.`,
      });
    }
  }

  // ──────────────── FINAL CHECK ────────────────

  if (errors.length > 0) {
    const { code, message } = errors[0];
    throw createHttpError(403, message, { code });
  }
};

export const getMarkingWindows = (attendance) => {
  const [year, month, day] = attendance.classDate.split('-').map(Number);
  const [startHour, startMinute] = attendance.classTime.start
    .split(':')
    .map(Number);
  const [endHour, endMinute] = attendance.classTime.end.split(':').map(Number);

  // Class start and end times in UTC
  const classStart = new Date(
    Date.UTC(year, month - 1, day, startHour, startMinute)
  );
  const classEnd = new Date(Date.UTC(year, month - 1, day, endHour, endMinute));

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

export const getDeviceInfo = (req) => ({
  ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
  userAgent: req.headers['user-agent'] || 'Unknown device',
  markedAt: new Date(),
});

export const evaluateGeo = (method, attendanceLocation, userLocation) => {
  let wasWithinRange = true;
  let distanceFromClassMeters = null;
  if (
    method === 'geo' &&
    attendanceLocation?.latitude &&
    userLocation?.latitude
  ) {
    const { distanceMeters, isWithinRange } = validateGeoProximity(
      userLocation,
      attendanceLocation
    );
    wasWithinRange = isWithinRange;
    distanceFromClassMeters = distanceMeters;
  }
  return { wasWithinRange, distanceFromClassMeters };
};

export const buildFlagReasons = (params) => {
  const { markTime, entryStart, entryEnd, method, wasWithinRange, location } =
    params;

  const flagReasons = [];

  if (markTime < entryStart || markTime > entryEnd) {
    flagReasons.push({
      code: 'outside_marking_window',
      note: `Marking attempted at ${markTime.toLocaleString()}, but allowed window is from ${entryStart.toLocaleString()} to ${entryEnd.toLocaleString()}`,
    });
  }

  if (method === 'geo' && !wasWithinRange) {
    flagReasons.push({
      code: 'location_mismatch',
      note: 'User was not within allowed geolocation range.',
    });
  }

  if (method === 'geo' && !location?.latitude) {
    flagReasons.push({
      code: 'geo_disabled',
      note: 'Geolocation data missing or not permitted by user.',
    });
  }

  return flagReasons;
};

export const notifyFlaggedCheckIn = async ({
  attendance,
  studentRecord,
  flagReasons,
  userId,
  io,
}) => {
  const group = await Group.findById(attendance.groupId).select('createdBy');
  if (!group?.createdBy) return;

  const readableReasons = flagReasons
    .map((r) => `${r.code} - ${r.note}`)
    .join(', ');

  await sendNotification({
    type: 'info',
    message: `${studentRecord.name || 'A student'} was flagged during check-in: ${readableReasons}`,
    forUser: group.createdBy,
    fromUser: userId,
    groupId: group._id,
    relatedId: attendance._id,
    relatedType: 'attendance',
    link: `/group/${group._id}/attendance/${attendance._id}`,
    io,
    actionApprove: 'review',
  });
};
