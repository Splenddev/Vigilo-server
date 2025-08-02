import createHttpError from 'http-errors';
import { validateGeoProximity } from './geoUtils.js';
import Group from '../models/group.js';
import { sendNotification } from './sendNotification.js';
import { applyTimeOffset } from './helpers.js';

export const getFinalStatus = ({
  checkInStatus,
  checkOutStatus,
  pleaStatus = null,
  mode = 'strict',
  enableCheckInOut = true,
}) => {
  if (pleaStatus === 'approved') {
    return 'excused';
  }

  if (!enableCheckInOut) {
    if (checkInStatus === 'absent') return 'absent';
    if (checkInStatus === 'on_time') return 'present';
    if (checkInStatus === 'late')
      return mode === 'detailed' ? 'late' : 'partial';
    return 'partial';
  }

  const isAbsent = checkInStatus === 'absent' && checkOutStatus === 'missed';

  if (mode === 'detailed') {
    if (isAbsent) return 'absent';
    if (checkInStatus === 'on_time' && checkOutStatus === 'on_time')
      return 'on_time';
    if (checkInStatus === 'late' && checkOutStatus === 'on_time') return 'late';
    if (checkInStatus === 'late' && checkOutStatus === 'left_early')
      return 'late_left_early';
    if (checkInStatus === 'on_time' && checkOutStatus === 'left_early')
      return 'left_early';
    if (checkInStatus !== 'absent' && checkOutStatus === 'missed')
      return 'not_checkout';
    if (checkInStatus === 'absent' && checkOutStatus !== 'missed')
      return 'not_checkin';
    return 'partial';
  }

  // strict mode
  if (isAbsent) return 'absent';
  if (checkInStatus === 'on_time' && checkOutStatus === 'on_time')
    return 'present';
  if (checkInStatus === 'late' && checkOutStatus === 'on_time')
    return 'partial';

  const partialConditions = [
    checkInStatus !== 'absent' && checkOutStatus === 'missed',
    checkInStatus === 'absent' && checkOutStatus !== 'missed',
    checkInStatus === 'late' && checkOutStatus === 'left_early',
    checkInStatus === 'on_time' && checkOutStatus === 'left_early',
  ];

  if (partialConditions.some(Boolean)) {
    return 'partial';
  }

  return 'absent';
};

export const enforceAttendanceSettings = (
  studentRecord,
  attendance,
  context
) => {
  const {
    mode, // 'checkIn' or 'checkOut'
    markTime, // Date object
    durationMinutes,
    entryStart, // Date object
    entryEnd, // Date object
    selfieProof,
    joinedAfterAttendanceCreated,
  } = context;

  const settings = attendance.settings || {};
  const errors = [];

  const formatTime = (date) =>
    new Date(date).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    });

  const diffMinutes = (a, b) => Math.round((a - b) / 60000);

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
    if (markTime < entryStart && !settings.allowEarlyCheckIn) {
      const delta = diffMinutes(entryStart, markTime);
      errors.push({
        code: 'TOO_EARLY_CHECKIN',
        message:
          `Check-in attempted ${delta} minutes earlier than allowed. Early check-in is not permitted.\n` +
          `➡️ Your check-in time: ${formatTime(markTime)} UTC\n` +
          `🕒 Allowed window: ${formatTime(entryStart)} - ${formatTime(entryEnd)} UTC`,
      });
    }

    if (markTime > entryEnd && !settings.allowLateCheckIn) {
      const delta = diffMinutes(markTime, entryEnd);
      errors.push({
        code: 'TOO_LATE_CHECKIN',
        message:
          `Check-in attempted ${delta} minutes after the allowed time window. Late check-in is not permitted.\n` +
          `➡️ Your check-in time: ${formatTime(markTime)} UTC\n` +
          `🕒 Allowed window: ${formatTime(entryStart)} - ${formatTime(entryEnd)} UTC`,
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
      const delta = diffMinutes(entryStart, markTime);
      errors.push({
        code: 'TOO_EARLY_CHECKOUT',
        message:
          `Check-out attempted ${delta} minutes earlier than allowed. Early check-out is not permitted.\n` +
          `➡️ Your check-out time: ${formatTime(markTime)} UTC\n` +
          `🕒 Allowed window: ${formatTime(entryStart)} - ${formatTime(entryEnd)} UTC`,
      });
    }

    if (markTime > entryEnd && !settings.allowLateCheckOut) {
      const delta = diffMinutes(markTime, entryEnd);
      errors.push({
        code: 'TOO_LATE_CHECKOUT',
        message:
          `Check-out attempted ${delta} minutes after the allowed time window. Late check-out is not permitted.\n` +
          `➡️ Your check-out time: ${formatTime(markTime)} UTC\n` +
          `🕒 Allowed window: ${formatTime(entryStart)} - ${formatTime(entryEnd)} UTC`,
      });
    }

    if (
      !attendance.reopened &&
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
  const classStart = new Date(attendance.classTime.utcStart); // ✅ Already UTC
  const classEnd = new Date(attendance.classTime.utcEnd); // ✅ Already UTC

  const entryStart = applyTimeOffset(
    classStart,
    attendance.entry?.start || '0H0M'
  );

  let entryEnd = applyTimeOffset(classStart, attendance.entry?.end || '1H30M');

  if (
    attendance.reopenedUntil &&
    new Date(attendance.reopenedUntil) > entryEnd
  ) {
    entryEnd = new Date(attendance.reopenedUntil);
  }

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
