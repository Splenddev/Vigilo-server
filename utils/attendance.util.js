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
    markTime,
    durationMinutes,
    entryStart,
    entryEnd,
    selfieProof,
    joinedAfterAttendanceCreated,
  } = context;

  const settings = attendance.settings || {};
  const errors = [];

  const toTime = (value) =>
    typeof value === 'number' ? value : new Date(value).getTime();

  const markTimestamp = toTime(markTime);
  const entryStartTime = toTime(entryStart);
  const entryEndTime = toTime(entryEnd);

  // ──────────────── GENERAL ────────────────

  if (
    settings.proofRequirement === 'selfie' &&
    mode === 'checkIn' &&
    !selfieProof
  ) {
    errors.push({
      code: 'PROOF_REQUIRED',
      message:
        'Selfie proof is required to mark attendance for this session. Please upload a valid selfie before checking in.',
    });
  }

  if (!settings.allowLateJoiners && joinedAfterAttendanceCreated) {
    errors.push({
      code: 'LATE_JOIN_BLOCKED',
      message:
        'You joined this group after attendance for the session was created. Late joiners are not allowed to mark attendance for this session.',
    });
  }

  // ──────────────── CHECK-IN ────────────────

  if (mode === 'checkIn') {
    if (markTimestamp < entryStartTime && !settings.allowEarlyCheckInOut) {
      errors.push({
        code: 'TOO_EARLY_CHECKIN',
        message: `Check-in attempt was made before the allowed time. You tried to check in at ${new Date(markTimestamp).toLocaleTimeString()}, but check-in opens at ${new Date(entryStartTime).toLocaleTimeString()}.`,
      });
    }

    if (markTimestamp > entryEndTime && !settings.allowLateCheckInOut) {
      errors.push({
        code: 'TOO_LATE_CHECKIN',
        message: `Check-in attempt was made after the allowed window. You tried to check in at ${new Date(markTimestamp).toLocaleTimeString()}, but check-in closed at ${new Date(entryEndTime).toLocaleTimeString()}.`,
      });
    }
  }

  // ──────────────── CHECK-OUT ────────────────

  if (mode === 'checkOut') {
    if (!settings.enableCheckInOut) {
      errors.push({
        code: 'CHECK_OUT_DISABLED',
        message:
          'Check-out is not enabled for this attendance session. You are only required to check in.',
      });
    }

    if (markTimestamp < entryStartTime && !settings.allowEarlyCheckOut) {
      errors.push({
        code: 'TOO_EARLY_CHECKOUT',
        message: `You attempted to check out before the allowed time. Your attempt was at ${new Date(markTimestamp).toLocaleTimeString()}, but check-out is only allowed from ${new Date(entryStartTime).toLocaleTimeString()}.`,
      });
    }

    if (markTimestamp > entryEndTime && !settings.allowLateCheckOut) {
      errors.push({
        code: 'TOO_LATE_CHECKOUT',
        message: `You attempted to check out after the allowed time. You checked out at ${new Date(markTimestamp).toLocaleTimeString()}, but check-out closed at ${new Date(entryEndTime).toLocaleTimeString()}.`,
      });
    }

    if (
      settings.minimumPresenceDuration &&
      durationMinutes < settings.minimumPresenceDuration
    ) {
      const formatMinutes = (min) => `${min} minute${min !== 1 ? 's' : ''}`;
      errors.push({
        code: 'SHORT_DURATION',
        message: `You were present for only ${formatMinutes(
          durationMinutes
        )}, but the required minimum stay is ${formatMinutes(
          settings.minimumPresenceDuration
        )}. This may indicate that you left early or didn't stay long enough.`,
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
