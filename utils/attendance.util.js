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
    markTime, // in minutes
    durationMinutes,
    entryStart,
    entryEnd,
    selfieProof,
    joinedAfterAttendanceCreated,
  } = context;

  const settings = attendance.settings || {};
  const errors = [];

  // ──────────────── GENERAL ────────────────

  if (settings.markOnce && (studentRecord.checkIn || studentRecord.checkOut)) {
    errors.push({
      code: 'MARK_ONCE_ENFORCED',
      message: 'You can only mark attendance once.',
    });
  }

  if (
    settings.proofRequirement === 'selfie' &&
    mode === 'checkIn' &&
    !selfieProof
  ) {
    errors.push({
      code: 'PROOF_REQUIRED',
      message: 'Selfie proof is required to mark attendance.',
    });
  }

  if (!settings.allowLateJoiners && joinedAfterAttendanceCreated) {
    errors.push({
      code: 'LATE_JOIN_BLOCKED',
      message:
        'You joined the group after attendance was created and cannot mark.',
    });
  }

  // ─── CHECK-IN ───
  if (mode === 'checkIn') {
    if (markTime < entryStart && !settings.allowEarlyCheckInOut) {
      errors.push({
        code: 'TOO_EARLY_CHECKIN',
        message: 'Check-in before allowed time.',
      });
    }

    if (markTime > entryEnd && !settings.allowLateCheckInOut) {
      errors.push({
        code: 'TOO_LATE_CHECKIN',
        message: 'Check-in after allowed time.',
      });
    }
  }

  // ──────────────── CHECK-OUT ────────────────

  if (mode === 'checkOut') {
    if (!settings.enableCheckInOut) {
      errors.push({
        code: 'CHECK_OUT_DISABLED',
        message: 'Check-out is disabled for this attendance.',
      });
    }

    if (markTime < entryStart && !settings.allowEarlyCheckOut) {
      errors.push({
        code: 'TOO_EARLY_CHECKOUT',
        message: 'You are checking out too early.',
      });
    }

    if (markTime > entryEnd && !settings.allowLateCheckOut) {
      errors.push({
        code: 'TOO_LATE_CHECKOUT',
        message: 'You are checking out after the allowed window.',
      });
    }

    if (
      settings.minimumPresenceDuration &&
      durationMinutes < settings.minimumPresenceDuration
    ) {
      errors.push({
        code: 'SHORT_DURATION',
        message: `You must stay at least ${settings.minimumPresenceDuration} minutes.`,
      });
    }
  }

  // ──────────────── FINAL ────────────────

  if (errors.length > 0) {
    const { code, message } = errors[0];
    throw createHttpError(403, message, { code });
  }
};

export const getMarkingWindows = (attendance) => {
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
