import createHttpError from 'http-errors';
import { emitAttendanceProgress } from '../markEntryhandlers/emitAttendanceProgress.js';

export const handleReopenLogic = async ({
  reqUserId,
  attendance,
  studentRecord,
  markTime,
  method,
  location,
  distanceFromClassMeters,
  io,
  res,
  classStart,
  classEnd,
}) => {
  const {
    reopenAllowedStudents = [],
    reopenedUntil,
    reopenFeatures = {},
    summaryStats,
  } = attendance;

  const now = markTime;
  const isWithinReopenWindow = !reopenedUntil || now <= new Date(reopenedUntil);
  const isStudentAllowed = reopenAllowedStudents.some(
    (id) => id.toString() === reqUserId.toString()
  );

  if (!isWithinReopenWindow) {
    return res.status(403).json({
      status: 403,
      code: 'REOPEN_EXPIRED',
      message: 'Reopen window has expired.',
      details: `The reopen window closed at ${new Date(reopenedUntil).toISOString()}, but the request was made at ${now.toISOString()}.`,
    });
  }

  if (!isStudentAllowed) {
    throw createHttpError(
      403,
      `Student with ID "${reqUserId}" is not in the allowed reopen list. Allowed IDs: [${reopenAllowedStudents.join(', ')}].`,

      {
        code: 'REOPEN_FORBIDDEN',
        details: 'You are not allowed to mark attendance during reopen.',
      }
    );
  }

  const alreadyCheckedIn = !!studentRecord.checkIn?.time;
  const alreadyCheckedOut = !!studentRecord.checkOut?.time;

  const {
    allowFreshCheckInOut = true,
    allowCheckOutForCheckedIn = false,
    enableFinalStatusControl = true,
    finalStatusRules = {},
    requireGeo = false,
  } = reopenFeatures;

  const {
    partialHandling = 'present', // for check-in only
    absentHandling = 'allow_all', // for fresh check-in + check-out required
  } = finalStatusRules;

  const metaLog = [];
  const nowTime = now.getTime();
  const arrivalDelta = Math.floor((now - classStart) / 60000);
  const departureDelta = Math.floor((classEnd - now) / 60000);
  const durationMinutes = alreadyCheckedIn
    ? Math.floor((now - new Date(studentRecord.checkIn.time)) / 60000)
    : 0;

  // CASE 1: Fresh check-in & check-out
  if (!alreadyCheckedIn && !alreadyCheckedOut) {
    if (!allowFreshCheckInOut) {
      return res.status(403).json({
        code: 'REOPEN_FRESH_DENIED',
        message: 'Fresh check-in and check-out not allowed during reopen.',
      });
    }
    if (requireGeo && !wasWithinRange) {
      throw createHttpError(
        403,
        'Geo-location required and user is out of range.',
        {
          code: 'REOPEN_GEO_REJECTED',
          distance: distanceFromClassMeters,
        }
      );
    }

    studentRecord.checkIn = {
      time: nowTime,
      method,
      location,
      distanceFromClassMeters,
    };
    studentRecord.checkOut = {
      time: nowTime,
      method,
      location,
      distanceFromClassMeters,
    };

    studentRecord.arrivalDeltaMinutes = arrivalDelta;
    studentRecord.departureDeltaMinutes = departureDelta;
    studentRecord.durationMinutes = 0;
    studentRecord.checkInStatus = 'late';
    studentRecord.checkOutStatus = 'left_early';
    studentRecord.checkInVerified = true;
    studentRecord.checkOutVerified = true;

    const finalStatus = enableFinalStatusControl ? absentHandling : 'late';
    studentRecord.finalStatus = finalStatus;

    summaryStats.totalPresent += 1;
    if (finalStatus === 'present') summaryStats.onTime += 1;
    if (finalStatus === 'partial') summaryStats.late += 1;

    metaLog.push({
      type: 'status_changed',
      description: 'Fresh check-in and check-out during reopened session.',
      data: {
        arrivalDelta,
        departureDelta,
        finalStatus,
        markTime: nowTime,
      },
      createdBy: 'system',
      createdAt: new Date(),
    });
  }

  // CASE 2: Already checked in, but not checked out
  else if (alreadyCheckedIn && !alreadyCheckedOut) {
    if (!allowCheckOutForCheckedIn) {
      return res.status(403).json({
        code: 'REOPEN_CHECKOUT_DENIED',
        message: 'Late check-out not allowed for already checked-in student.',
      });
    }

    studentRecord.checkOut = {
      time: nowTime,
      method,
      location,
      distanceFromClassMeters,
    };
    studentRecord.departureDeltaMinutes = departureDelta;
    studentRecord.durationMinutes = durationMinutes;
    studentRecord.checkOutVerified = true;
    studentRecord.checkOutStatus =
      departureDelta >= 0 ? 'on_time' : 'left_early';

    const finalStatus = enableFinalStatusControl
      ? partialHandling
      : getFinalStatus({
          checkInStatus: studentRecord.checkInStatus,
          checkOutStatus: studentRecord.checkOutStatus,
          pleaStatus: studentRecord.plea?.status,
        });

    // Update summary stats
    const prevFinal = studentRecord.finalStatus;
    if (prevFinal === 'present') summaryStats.onTime -= 1;
    else if (prevFinal === 'partial') summaryStats.late -= 1;

    studentRecord.finalStatus = finalStatus;
    if (finalStatus === 'present') summaryStats.onTime += 1;
    if (finalStatus === 'partial') summaryStats.late += 1;

    metaLog.push({
      type: 'status_changed',
      description: 'Late check-out during reopened session.',
      data: {
        durationMinutes,
        departureDelta,
        finalStatus,
        markTime: nowTime,
      },
      createdBy: 'system',
      createdAt: new Date(),
    });
  }

  // CASE 3: Already checked in and checked out
  else {
    return res.status(409).json({
      code: 'REOPEN_ALREADY_COMPLETE',
      message: 'You have already checked in and checked out.',
    });
  }

  studentRecord.meta = [...(studentRecord.meta || []), ...metaLog];
  await studentRecord.save();
  await attendance.save();

  emitAttendanceProgress(io, attendance, studentRecord);

  return res.status(200).json({
    success: true,
    message: 'Attendance marked during reopened session.',
    checkInTime: studentRecord.checkIn?.time,
    checkOutTime: studentRecord.checkOut?.time,
    durationMinutes: studentRecord.durationMinutes,
    status: studentRecord.finalStatus,
    meta: studentRecord.meta,
  });
};
