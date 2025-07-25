import mongoose from 'mongoose';
import Attendance from '../models/attendance.model.js';
import Group from '../models/group.js';
import { generateAttendanceId } from '../utils/idGenerator.js';
import createHttpError from 'http-errors';
import { sendNotification } from '../utils/sendNotification.js';

import {
  getMarkingWindows,
  getDeviceInfo,
  evaluateGeo,
  buildFlagReasons,
  notifyFlaggedCheckIn,
  getFinalStatus,
  enforceAttendanceSettings,
} from '../utils/attendance.util.js';

import { validateCreateAttendancePayload } from '../validators/attendance.validator.js';
import { toMinutes } from '../utils/timeUtils.js';
import {
  checkDuplicateAttendance,
  getGroupAndSchedule,
} from '../services/attendance.service.js';

import StudentAttendance from '../models/student.attendance.model.js';

import {
  isSameDay,
  isBefore,
  parseISO,
  addMinutes,
  addHours,
  differenceInMinutes,
  differenceInDays,
  setHours,
  setMinutes,
  isAfter,
  endOfDay,
  min,
} from 'date-fns';
import { emitAttendanceProgress } from '../handlers/attendance.handlers/markEntryhandlers/emitAttendanceProgress.js';
import { applyTimeOffset } from '../utils/helpers.js';

export const createAttendance = async (req, res) => {
  try {
    const {
      groupId,
      scheduleId,
      classDate,
      classTime,
      location,
      entry,
      attendanceType,
      settings,
      courseCode,
      courseTitle,
      lecturer,
      autoEnd,
    } = req.body;

    const createdBy = req.user._id;
    const createdByName = req.user.name;
    const io = req.io;

    const now = new Date();
    const classDateObj = new Date(classDate);

    // ❌ Reject past class dates
    if (isBefore(classDateObj, now.setHours(0, 0, 0, 0))) {
      return res.status(400).json({
        success: false,
        code: 'PAST_DATE',
        message: 'You cannot create attendance for a past date.',
      });
    }

    // ✅ Auto-detect classTime.day from classDate
    const dayOfWeek = classDateObj.toLocaleDateString('en-US', {
      weekday: 'long',
    });

    const computedClassTime = {
      ...classTime,
      day: dayOfWeek,
    };

    const isToday = isSameDay(classDateObj, new Date());
    const status = isToday ? 'active' : 'upcoming';

    validateCreateAttendancePayload(req.body, computedClassTime);

    // ✅ Entry window validation
    if (entry?.start && entry?.end) {
      const entryStartMins = toMinutes(entry.start, computedClassTime);
      const entryEndMins = toMinutes(entry.end, computedClassTime);
      if (
        entryStartMins === null ||
        entryEndMins === null ||
        entryEndMins <= entryStartMins
      ) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_ENTRY_WINDOW',
          message: 'Marking end must be after start, in valid H and M format.',
        });
      }
    }

    const duplicate = await checkDuplicateAttendance({
      scheduleId,
      courseCode,
      courseTitle,
      classDate,
      classTime: computedClassTime,
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        code: 'ATTENDANCE_EXISTS',
        message: `Attendance already exists for this schedule on ${classDate} at ${classTime.start}.`,
        attendanceId: duplicate.attendanceId,
      });
    }

    const { group, schedule } = await getGroupAndSchedule(groupId, scheduleId);
    if (!group) {
      return res.status(404).json({
        success: false,
        code: 'GROUP_NOT_FOUND',
        message: `No group found with ID "${groupId}".`,
      });
    }
    if (scheduleId && !schedule) {
      return res.status(404).json({
        success: false,
        code: 'SCHEDULE_NOT_FOUND',
        message: `No schedule found with ID "${scheduleId}".`,
      });
    }

    const todaysCount = await Attendance.countDocuments({ groupId, classDate });
    const attendanceId = await generateAttendanceId(
      groupId,
      classDate,
      todaysCount + 1
    );

    const newAttendance = await Attendance.create({
      attendanceId,
      groupId,
      scheduleId,
      classDate,
      courseCode,
      courseTitle,
      classTime: computedClassTime,
      entry,
      location,
      attendanceType: attendanceType || 'physical',
      status,
      autoEnd,
      initialized: isToday,
      createdBy,

      // ✅ Lecturer details
      lecturer: {
        name: schedule?.lecturer?.name || lecturer?.name,
        email: schedule?.lecturer?.email || lecturer?.email || '',
      },

      // ✅ Settings from schema
      settings: {
        markOnce: settings?.markOnce ?? true,
        allowLateJoiners: settings?.allowLateJoiners ?? true,
        lateThreshold: settings?.lateThreshold ?? 10,
        pleaWindowDays: settings?.pleaWindowDays ?? 3,
        proofRequirement: settings?.proofRequirement ?? 'none',

        enableCheckInOut: settings?.enableCheckInOut ?? false,
        allowEarlyCheckIn: settings?.allowEarlyCheckIn ?? false,
        allowLateCheckOut: settings?.allowLateCheckOut ?? true,
        allowLateCheckIn: settings?.allowLateCheckIn ?? false,
        allowEarlyCheckOut: settings?.allowEarlyCheckOut ?? true,
        autoCheckOut: settings?.autoCheckOut ?? true,
        minimumPresenceDuration: settings?.minimumPresenceDuration ?? 45,

        repeatable: settings?.repeatable ?? false,
        notifyOnStart: settings?.notifyOnStart ?? true,

        // ✅ Marking Config (nested properly)
        markingConfig: {
          type: settings?.markingConfig?.type ?? 'strict',
          mode: settings?.markingConfig?.mode ?? 'no_code',
        },
      },
    });

    let studentDocs = [];

    if (status === 'active') {
      studentDocs = group.members.map((student) => ({
        attendanceId: newAttendance._id,
        studentId: student._id,
        name: student.name,
        role: student.role,
        studentMatric: student.matricNumber,
      }));
      await StudentAttendance.insertMany(studentDocs);
    }

    // ✅ Send notifications
    await Promise.all(
      group.members.map((member) => {
        const isCreator = member._id.toString() === createdBy.toString();
        const displayName = isCreator ? 'you' : createdByName;

        return sendNotification({
          forUser: member._id,
          fromUser: createdBy,
          type: 'attendance',
          message: `🎓 Attendance is now open for ${courseTitle} (${courseCode}) on ${classDate}, ${classTime.start} – ${classTime.end}, created by ${displayName}.`,
          relatedId: newAttendance._id,
          relatedType: 'attendance',
          groupId,
          link: `/group/${groupId}/attendance/${newAttendance._id}`,
          io,
        });
      })
    );

    // ✅ Emit socket event
    if (io && groupId) {
      io.to(groupId.toString()).emit('attendance:update', {
        type: 'create',
        attendanceId: newAttendance.attendanceId,
        groupId,
        date: classDate,
        createdBy: {
          id: createdBy,
          name: createdByName,
        },
        course: {
          code: courseCode,
          title: courseTitle,
        },
        time: computedClassTime,
      });
    }

    return res.status(201).json({
      success: true,
      message: `Attendance session ${attendanceId} created successfully by ${createdByName}.`,
      attendance: {
        id: newAttendance._id,
        attendanceId: newAttendance.attendanceId,
        groupId: newAttendance.groupId,
        classDate: newAttendance.classDate,
        status: newAttendance.status,
        totalStudents: studentDocs.length || group.members.length,
        createdAt: newAttendance.createdAt,
      },
    });
  } catch (err) {
    console.error('❌ Error creating attendance:', err);
    return res.status(err.status || 500).json({
      success: false,
      code: err.code || 'SERVER_ERROR',
      message: err.message || 'An unexpected server error occurred.',
    });
  }
};

export const getGroupAttendances = async (req, res) => {
  const { groupId } = req.params;

  try {
    if (!groupId) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_GROUP_ID',
        message: 'Group ID is required.',
      });
    }

    const attendances = await Attendance.find({ groupId })
      .sort({ classDate: 1 })
      .populate('studentRecords'); // Populate external student records if available

    res.status(200).json({
      success: true,
      count: attendances.length,
      attendances,
    });
  } catch (error) {
    console.error('❌ Error fetching group attendances:', error);
    res.status(500).json({
      success: false,
      code: 'FETCH_ATTENDANCE_FAILED',
      message: 'Failed to fetch attendances.',
      error: error.message,
    });
  }
};

export const getGroupAttendanceTab = async (req, res) => {
  try {
    const { groupId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_GROUP_ID',
        message: 'Invalid group ID.',
      });
    }

    const attendances = await Attendance.find({ groupId })
      .sort({ classDate: -1 })
      .populate('studentRecords'); // important for externalized student records

    if (!attendances.length) {
      return res.status(200).json({
        success: true,
        data: {
          groupId,
          summary: {},
          recentSessions: [],
          topAbsentees: [],
          pleaRequests: [],
          exportOptions: { available: false },
          actions: {},
        },
      });
    }

    const now = Date.now();
    const isClosed = (a) => {
      const end = new Date(
        `${a.classDate}T${a.classTime?.end || '23:59'}`
      ).getTime();
      return !isNaN(end) && end <= now;
    };

    const activeSession = attendances.find((a) => a.status === 'active');
    const closedAttendances = attendances.filter(isClosed);

    const totalSessions = closedAttendances.length;
    const totalMarked = closedAttendances.reduce(
      (acc, a) =>
        acc + a.studentRecords.filter((s) => s.finalStatus !== 'absent').length,
      0
    );
    const totalStudents = closedAttendances.reduce(
      (acc, a) => acc + a.studentRecords.length,
      0
    );
    const avgAttendanceRate =
      totalStudents > 0
        ? ((totalMarked / totalStudents) * 100).toFixed(1)
        : '0.0';

    const recentSessions = attendances.slice(0, 5).map((a) => ({
      attendanceId: a.attendanceId,
      date: a.classDate,
      topic: a.courseTitle || 'Untitled',
      lecturer: a.lecturer?.name || 'N/A',
      marked: a.studentRecords.filter((s) => s.finalStatus !== 'absent').length,
      late: isClosed(a) ? a.summaryStats?.late || 0 : 0,
      absent: isClosed(a) ? a.summaryStats?.absent || 0 : 0,
      status: a.status,
    }));

    const studentStats = {};
    closedAttendances.forEach((a) => {
      a.studentRecords.forEach((s) => {
        const id = s.studentId.toString();
        if (!studentStats[id]) {
          studentStats[id] = {
            studentId: id,
            name: s.name,
            absences: 0,
            lateMarks: 0,
            presentCount: 0,
            attendanceCount: 0,
          };
        }
        if (s.finalStatus === 'absent') studentStats[id].absences += 1;
        if (s.finalStatus === 'late') studentStats[id].lateMarks += 1;
        if (s.finalStatus !== 'absent') studentStats[id].presentCount += 1;
        studentStats[id].attendanceCount += 1;
      });
    });

    const topAbsentees = Object.values(studentStats)
      .map((s) => ({
        studentId: s.studentId,
        name: s.name,
        absences: s.absences,
        lateMarks: s.lateMarks,
        attendanceRate:
          s.attendanceCount > 0
            ? ((s.presentCount / s.attendanceCount) * 100).toFixed(1)
            : '0.0',
      }))
      .filter((s) => s.absences > 0)
      .sort((a, b) => b.absences - a.absences)
      .slice(0, 5);

    const pleaRequests = [];
    closedAttendances.forEach((a) => {
      a.studentRecords.forEach((s) => {
        if (
          s.plea?.status === 'pending' &&
          ((Array.isArray(s.plea.reasons) && s.plea.reasons.length > 0) ||
            s.plea.proofUpload?.fileUrl)
        ) {
          pleaRequests.push({
            pleaId: `${a._id}-${s.studentId}`,
            studentId: s.studentId,
            name: s.name,
            date: a.classDate,
            reason: s.plea.reasons?.[0] || '',
            proofUrl: s.plea.proofUpload?.fileUrl || null,
            status: s.plea.status,
          });
        }
      });
    });

    return res.status(200).json({
      success: true,
      data: {
        groupId,
        summary: {
          totalSessions,
          totalMarked,
          totalAbsent: totalStudents - totalMarked,
          avgAttendanceRate: Number(avgAttendanceRate),
          activeSession: activeSession
            ? {
                isActive: true,
                attendanceId: activeSession.attendanceId,
                topic: activeSession.courseTitle || 'Untitled',
                lecturer: activeSession.lecturer?.name || 'N/A',
                startTime: activeSession.classTime?.start,
                endTime: activeSession.classTime?.end,
                studentsMarked: activeSession.studentRecords.filter(
                  (s) => s.finalStatus !== 'absent'
                ).length,
                studentsAllowed: activeSession.studentRecords.length,
              }
            : null,
        },
        recentSessions,
        topAbsentees,
        pleaRequests,
        exportOptions: {
          available: true,
          formats: ['csv', 'pdf'],
          downloadLink: `/app/attendance/export/${groupId}`,
        },
      },
    });
  } catch (err) {
    console.error('AttendanceTab Error:', err);
    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: 'Failed to load group attendance tab.',
    });
  }
};

export const markGeoAttendanceEntry = async (req, res) => {
  try {
    const { attendanceId } = req.params;
    const userId = req.user._id;
    const {
      method = 'geo',
      time = new Date().getTime(),
      location = {},
      mode = 'checkIn',
    } = req.body;
    const io = req.io;
    console.log(time);
    const attendance = await Attendance.findById(attendanceId);
    if (!attendance)
      throw createHttpError(404, 'Attendance session not found.', {
        code: 'ATTENDANCE_NOT_FOUND',
      });
    if (attendance.status !== 'active')
      throw createHttpError(403, 'Attendance is closed.', {
        code: 'ATTENDANCE_CLOSED',
      });

    const studentRecord = await StudentAttendance.findOne({
      attendanceId,
      studentId: userId,
    });
    if (!studentRecord)
      throw createHttpError(
        403,
        'You are not allowed to mark this attendance.',
        { code: 'NOT_ALLOWED_TO_MARK' }
      );

    const markTime = new Date(time);
    const { classStart, classEnd, entryStart, entryEnd } =
      getMarkingWindows(attendance);

    const { wasWithinRange, distanceFromClassMeters } = evaluateGeo(
      method,
      attendance.location,
      location
    );
    const deviceInfo = getDeviceInfo(req);

    if (attendance.reopened) {
      const alreadyCheckedIn = !!studentRecord.checkIn?.time;
      const alreadyCheckedOut = !!studentRecord.checkOut?.time;

      const metaLog = [];

      if (!alreadyCheckedIn) {
        studentRecord.checkIn = {
          time: markTime.getTime(),
          method,
          location,
          distanceFromClassMeters,
        };
        studentRecord.checkInStatus = 'on_time';
        studentRecord.checkInVerified = true;

        metaLog.push({
          type: 'status_changed',
          description: 'Session reopened. Skipped check-out.',
          data: {
            sessionStatus: 'on_time',
            markTime: markTime.getTime(),
          },
          createdBy: 'system',
          createdAt: new Date(),
        });

        studentRecord.finalStatus = 'present';
        attendance.summaryStats.totalPresent += 1;
        attendance.summaryStats.onTime += 1;
      } else if (!alreadyCheckedOut) {
        studentRecord.checkOut = {
          time: markTime.getTime(),
          method,
          location,
          distanceFromClassMeters,
        };
        studentRecord.checkOutVerified = true;
        studentRecord.checkInStatus = 'late';

        metaLog.push({
          type: 'status_changed',
          description: 'Reopened session. Late check-out recorded.',
          data: {
            sessionStatus: 'checked_out_late',
            markTime: markTime.getTime(),
          },
          createdBy: 'system',
          createdAt: new Date(),
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'You have already checked in and checked out.',
        });
      }

      // Merge with existing meta if needed
      studentRecord.meta = [...(studentRecord.meta || []), ...metaLog];

      await studentRecord.save();
      await attendance.save();

      emitAttendanceProgress(io, attendance, studentRecord);

      return res.status(200).json({
        success: true,
        message: alreadyCheckedIn
          ? 'Late check-out recorded due to session being reopened.'
          : 'Check-in and check-out skipped due to session being reopened.',
        checkInTime: studentRecord.checkIn?.time,
        checkOutTime: studentRecord.checkOut?.time,
        status: studentRecord.finalStatus,
        meta: studentRecord.meta,
      });
    }

    if (mode === 'checkIn') {
      if (studentRecord.checkIn?.time)
        throw createHttpError(409, 'You have already marked check-in.', {
          code: 'ALREADY_CHECKED_IN',
          checkInTime: studentRecord.checkIn.time,
        });

      const arrivalDeltaMinutes = Math.floor((markTime - classStart) / 60000);

      enforceAttendanceSettings(studentRecord, attendance, {
        mode: 'checkIn',
        markTime: markTime.getTime(),
        entryStart: entryStart.getTime(),
        entryEnd: entryEnd.getTime(),
        selfieProof: req.body.selfieProof,
        joinedAfterAttendanceCreated:
          studentRecord.joinedAfterAttendanceCreated, // optional
      });

      studentRecord.checkIn = {
        time: markTime.getTime(),
        method,
        location,
        distanceFromClassMeters,
      };
      studentRecord.arrivalDeltaMinutes = arrivalDeltaMinutes;
      studentRecord.wasWithinRange = wasWithinRange;
      studentRecord.checkInVerified = method === 'geo' ? wasWithinRange : false;
      studentRecord.markedBy = 'student';
      studentRecord.deviceInfo = deviceInfo;
      studentRecord.checkInStatus =
        arrivalDeltaMinutes <= 0 ? 'on_time' : 'late';

      const flagReasons = buildFlagReasons({
        markTime: markTime.getTime(),
        entryStart,
        entryEnd,
        method,
        wasWithinRange,
        location,
      });

      if (flagReasons.length > 0) {
        studentRecord.flagged = {
          isFlagged: true,
          reasons: flagReasons.map((r) => ({
            type: r.code,
            note: r.note,
            severity: r.severity || 'medium',
            detectedBy: 'system',
          })),
          flaggedAt: new Date(),
          flaggedBy: userId,
        };
      }

      studentRecord.finalStatus = getFinalStatus({
        checkInStatus: studentRecord.checkInStatus,
        checkOutStatus: studentRecord.checkOutStatus,
        pleaStatus: studentRecord.plea?.status,
      });

      if (studentRecord.finalStatus === 'present')
        attendance.summaryStats.onTime += 1;
      else if (studentRecord.finalStatus === 'partial')
        attendance.summaryStats.late += 1;
      attendance.summaryStats.totalPresent += 1;

      await Promise.all([studentRecord.save(), attendance.save()]);
      emitAttendanceProgress(io, attendance, studentRecord);

      if (flagReasons.length > 0) {
        await notifyFlaggedCheckIn({
          attendance,
          studentRecord,
          flagReasons,
          userId,
          io,
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Check-in successful.',
        checkInTime: markTime.getTime(),
        arrivalDeltaMinutes,
        distanceFromClassMeters,
        wasWithinRange,
        status: studentRecord.finalStatus,
        flagged: studentRecord.flagged,
      });
    }

    // Proceed with check-out process if session is not reopened
    if (mode === 'checkOut') {
      if (!studentRecord.checkIn?.time)
        throw createHttpError(403, 'You must check in before checking out.', {
          code: 'CHECK_IN_REQUIRED',
        });
      if (studentRecord.checkOut?.time)
        throw createHttpError(409, 'You have already marked check-out.', {
          code: 'ALREADY_CHECKED_OUT',
          checkOutTime: studentRecord.checkOut.time,
        });

      const departureDeltaMinutes = Math.floor((classEnd - markTime) / 60000);
      const durationMinutes = Math.floor(
        (markTime - new Date(studentRecord.checkIn.time)) / 60000
      );

      enforceAttendanceSettings(studentRecord, attendance, {
        mode: 'checkOut',
        markTime: markTime.getTime(),
        entryStart: entryStart.getTime(),
        entryEnd: entryEnd.getTime(),
        durationMinutes,
      });

      studentRecord.checkOut = {
        time: markTime.getTime(),
        method,
        location,
        distanceFromClassMeters,
      };
      studentRecord.departureDeltaMinutes = departureDeltaMinutes;
      studentRecord.durationMinutes = durationMinutes;
      studentRecord.checkOutStatus =
        departureDeltaMinutes >= 0 ? 'on_time' : 'left_early';

      const prevFinal = studentRecord.finalStatus;
      studentRecord.finalStatus = getFinalStatus({
        checkInStatus: studentRecord.checkInStatus,
        checkOutStatus: studentRecord.checkOutStatus,
        pleaStatus: studentRecord.plea?.status,
      });

      if (prevFinal === 'present') attendance.summaryStats.onTime -= 1;
      else if (prevFinal === 'partial') attendance.summaryStats.late -= 1;

      if (studentRecord.finalStatus === 'present')
        attendance.summaryStats.onTime += 1;
      else if (studentRecord.finalStatus === 'partial')
        attendance.summaryStats.late += 1;

      await Promise.all([studentRecord.save(), attendance.save()]);
      emitAttendanceProgress(io, attendance, studentRecord);

      return res.status(200).json({
        success: true,
        message: 'Check-out successful.',
        checkOutTime: markTime.getTime(),
        durationMinutes,
        departureDeltaMinutes,
        distanceFromClassMeters,
        status: studentRecord.finalStatus,
      });
    }

    throw createHttpError(400, 'Invalid marking mode.', {
      code: 'INVALID_MARK_MODE',
    });
  } catch (err) {
    console.error('Mark entry error:', err);
    res.status(err.status || 500).json({
      success: false,
      code: err.code || 'SERVER_ERROR',
      message: err.message || 'Something went wrong during marking.',
    });
  }
};

export const finalizeSingleAttendance = async (req, res) => {
  try {
    const { attendanceId } = req.params;
    const { io } = req;

    if (!mongoose.Types.ObjectId.isValid(attendanceId)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_ID',
        message: 'Invalid attendance ID.',
      });
    }

    const session =
      await Attendance.findById(attendanceId).populate('studentRecords');
    if (!session) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Attendance session not found.',
      });
    }

    if (session.status !== 'active') {
      return res.status(400).json({
        success: false,
        code: 'ALREADY_CLOSED',
        message: 'This session has already been finalized.',
      });
    }

    const classEnd = new Date(`${session.classDate}T${session.classTime.end}`);
    const now = new Date();
    if (classEnd > now) {
      return res.status(400).json({
        success: false,
        code: 'CLASS_NOT_ENDED',
        message: 'You cannot finalize attendance before class ends.',
        classEnd,
        currentTime: now,
      });
    }

    // Update student attendance records
    let absents = 0;
    let withPlea = 0;
    let onTime = 0;
    let late = 0;
    let leftEarly = 0;
    let totalPresent = 0;

    for (const record of session.studentRecords) {
      if (!record.finalStatus || record.finalStatus === 'absent') {
        absents++;
        await StudentAttendance.findByIdAndUpdate(record._id, {
          status: 'absent',
        });
      } else {
        totalPresent++;
        if (record.finalStatus === 'on_time') onTime++;
        else if (record.finalStatus === 'late') late++;
        else if (record.finalStatus === 'left_early') leftEarly++;
      }

      if (
        record.plea?.status === 'pending' ||
        record.plea?.reasons?.length > 0
      ) {
        withPlea++;
      }
    }

    session.status = 'closed';
    session.summaryStats = {
      totalPresent,
      onTime,
      late,
      leftEarly,
      absent: absents,
      withPlea,
    };
    await session.save();

    // Notify class rep
    const group = await Group.findById(session.groupId);
    const classRepId = group?.createdBy || group?.classRep;

    if (classRepId) {
      await sendNotification({
        type: 'info',
        message: `📘 Attendance finalized for ${session.courseTitle || 'a course'} on ${session.classDate}. ${absents} absent, ${totalPresent} present.`,
        forUser: classRepId,
        groupId: session.groupId,
        relatedId: session._id,
        relatedType: 'attendance',
        io,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Attendance session finalized.',
      attendanceId: session.attendanceId,
      stats: session.summaryStats,
    });
  } catch (err) {
    console.error('❌ Finalize attendance error:', err);
    return res.status(500).json({
      success: false,
      code: 'FINALIZE_ERROR',
      message: 'Something went wrong while finalizing attendance.',
    });
  }
};

export const deleteAttendance = async (req, res) => {
  try {
    const { attendanceId } = req.params;
    const { io } = req;

    if (!mongoose.Types.ObjectId.isValid(attendanceId)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_ATTENDANCE_ID',
        message: 'The provided attendanceId is not a valid MongoDB ObjectId.',
      });
    }

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({
        success: false,
        code: 'ATTENDANCE_NOT_FOUND',
        message: 'Attendance session not found.',
      });
    }

    if (attendance.status === 'active') {
      return res.status(403).json({
        success: false,
        code: 'ATTENDANCE_ACTIVE',
        message: 'Cannot delete an active attendance session.',
      });
    }

    await Attendance.findByIdAndDelete(attendanceId);

    // 🔔 Emit socket event to group room
    io?.to(attendance.groupId.toString()).emit('attendance:deleted', {
      attendanceId,
      classDate: attendance.classDate,
      groupId: attendance.groupId,
    });

    return res.status(200).json({
      success: true,
      message: 'Attendance session deleted successfully.',
      data: {
        attendanceId,
        classDate: attendance.classDate,
        groupId: attendance.groupId,
      },
    });
  } catch (err) {
    console.error('❌ Delete Attendance Error:', err);
    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: 'Something went wrong while deleting the attendance session.',
    });
  }
};

export const reopenAttendanceSession = async (req, res) => {
  try {
    const { attendanceId } = req.params;
    const {
      durationMinutes = '0H15M',
      allowedOptions = [],
      customMatricNumbers = [],
    } = req.body;
    const { io } = req;

    if (!mongoose.Types.ObjectId.isValid(attendanceId)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_ATTENDANCE_ID',
        message: 'Invalid attendance ID provided.',
      });
    }

    const session = await Attendance.findById(attendanceId);
    if (!session) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Attendance session not found.',
      });
    }

    if (session.status === 'active') {
      return res.status(400).json({
        success: false,
        code: 'ALREADY_ACTIVE',
        message: 'This attendance session is already active.',
      });
    }

    const classDateObj = parseISO(session.classDate);
    const now = new Date();
    const daysSince = differenceInDays(now, classDateObj);

    if (daysSince > 5) {
      return res.status(403).json({
        success: false,
        code: 'OLD_SESSION',
        message: `Cannot reopen sessions older than ${daysSince}.`,
      });
    }

    const groupId = session.groupId.toString();
    const allStudentRecords = await StudentAttendance.find({
      attendanceId: session._id,
    });

    let allowedStudentIds = [];

    const allOptionSelected = allowedOptions.includes('all');

    const filters = {
      approvedPleas: [],
      missedCheckouts: [],
      noCheckInOrOut: [],
      lateCheckIns: [],
      geoFailed: [],
      customMatric: [],
    };
    if (allOptionSelected) {
      allowedStudentIds = allStudentRecords.map((record) =>
        record.studentId.toString()
      );
    } else {
      //  if (allowedOptions.includes('approved_pleas')) {
      //    const pleas = await Plea.find({
      //      attendance: attendanceId,
      //      status: 'approved',
      //    }).lean();

      //    filters.approvedPleas = pleas.map((plea) => plea.student.toString());
      //  }

      if (allowedOptions.includes('forgot_checkout')) {
        filters.missedCheckouts = allStudentRecords
          .filter((r) => r.checkIn.time && r.checkOutStatus === 'missed')
          .map((r) => r.studentId.toString());
      }

      if (allowedOptions.includes('late_checkin')) {
        filters.lateCheckIns = allStudentRecords
          .filter((r) => r.checkInStatus === 'late')
          .map((r) => r.studentId.toString());
      }

      if (
        allowedOptions.includes('custom_matric') &&
        Array.isArray(customMatricNumbers)
      ) {
        const customStudents = allStudentRecords.filter((r) =>
          customMatricNumbers.includes(r.studentMatric)
        );
        filters.customMatric = customStudents.map((r) => r.student.toString());
      }

      const merged = [
        ...filters.approvedPleas,
        ...filters.missedCheckouts,
        ...filters.noCheckInOrOut,
        ...filters.lateCheckIns,
        ...filters.geoFailed,
        ...filters.customMatric,
      ];

      allowedStudentIds = [...new Set(merged)];
    }

    // 🕐 Compute class start time
    const [startHour, startMin] = session.classTime.start
      .split(':')
      .map(Number);
    const classStartTime = setHours(
      setMinutes(classDateObj, startMin),
      startHour
    );

    // 🕒 Original entry timing
    const originalEntryStart = applyTimeOffset(
      classStartTime,
      session.entry.start
    );
    const originalEntryEnd = applyTimeOffset(
      originalEntryStart,
      session.entry.end
    );

    // ⏱️ Parse reopen duration
    const match = durationMinutes.match(/(?:(\d+)H)?(?:(\d+)M)?/i);
    const reopenH = parseInt(match?.[1] || '0', 10);
    const reopenM = parseInt(match?.[2] || '0', 10);

    // 🕔 Compute capped reopen end time
    const rawReopenEnd = addMinutes(addHours(now, reopenH), reopenM);
    const dayEnd = endOfDay(classDateObj);
    const reopenEnd = min([rawReopenEnd, dayEnd]);

    // Only update entry.end if now > original entryEnd
    if (isAfter(now, originalEntryEnd)) {
      const diffMins = differenceInMinutes(reopenEnd, classStartTime);
      const newH = Math.floor(diffMins / 60);
      const newM = diffMins % 60;
      session.entry.end = `${newH}H${newM}M`;
    }

    session.reopenedUntil = reopenEnd;
    session.reopenDuration = durationMinutes;
    session.status = 'active';
    session.reopened = true;
    await session.save();

    // 📢 Notify class rep
    const group = await Group.findById(groupId);
    const classRepId = group?.createdBy || group?.classRep;

    if (classRepId) {
      await sendNotification({
        type: 'info',
        message: `🔄 Attendance reopened for ${session.courseCode} - ${session.courseTitle || 'Untitled'} on ${session.classDate}. Students can now check in again.`,
        forUser: classRepId,
        groupId: session.groupId,
        relatedId: session._id,
        relatedType: 'attendance',
        io,
      });
    }

    io?.to(session.groupId.toString()).emit('attendance:reopened', {
      attendanceId: session._id,
      groupId: session.groupId,
      classDate: session.classDate,
      courseCode: session.courseCode,
      courseTitle: session.courseTitle,
    });

    return res.status(200).json({
      success: true,
      message: `Attendance session ${session.attendanceId} has been reopened.`,
      attendanceId: session.attendanceId,
    });
  } catch (err) {
    console.error('❌ Reopen attendance error:', err);
    return res.status(500).json({
      success: false,
      code: 'REOPEN_ERROR',
      message: 'Something went wrong while reopening attendance.',
    });
  }
};
