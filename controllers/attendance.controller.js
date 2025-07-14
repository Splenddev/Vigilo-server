import mongoose from 'mongoose';
import Attendance from '../models/attendance.model.js';
import Group from '../models/group.js';
import { generateAttendanceId } from '../utils/idGenerator.js';
import createHttpError from 'http-errors';
import { validateGeoProximity } from '../utils/geoUtils.js';
import { applyTimeOffset } from '../utils/helpers.js';
import { sendNotification } from '../utils/sendNotification.js';

import { validateCreateAttendancePayload } from '../validators/attendance.validator.js';
import { toMinutes } from '../utils/timeUtils.js';
import {
  checkDuplicateAttendance,
  getGroupAndSchedule,
} from '../services/attendance.service.js';

import StudentAttendance from '../models/student.attendance.model.js';

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
      markingConfig,
      courseCode,
      courseTitle,
      lecturer,
    } = req.body;

    const createdBy = req.user._id;
    const createdByName = req.user.name;
    const io = req.io; // ✅ Socket instance

    validateCreateAttendancePayload(req.body, classTime);

    // Entry Window Validation
    if (entry?.start && entry?.end) {
      const entryStartMins = toMinutes(entry.start, classTime);
      const entryEndMins = toMinutes(entry.end, classTime);
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

    // Duplicate Check
    const duplicate = await checkDuplicateAttendance({
      scheduleId,
      courseCode,
      courseTitle,
      classDate,
      classTime,
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
    const attendanceId = generateAttendanceId(
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
      classTime,
      entry,
      location,
      attendanceType: attendanceType || 'physical',
      markingConfig,
      createdBy,
      lecturer: {
        name: schedule?.lecturer?.name || lecturer?.name,
        email: schedule?.lecturer?.email || lecturer?.email || '',
      },
    });

    const studentDocs = group.members.map((student) => ({
      attendanceId: newAttendance._id,
      studentId: student._id,
      name: student.name,
      status: 'absent',
      role: student.role,
    }));
    await StudentAttendance.insertMany(studentDocs);

    await Promise.all(
      group.members.map((member) => {
        const isCreator = member._id.toString() === createdBy.toString();
        const displayName = isCreator ? 'you' : createdByName;

        return sendNotification({
          forUser: member._id,
          fromUser: createdBy,
          type: 'attendance',
          message: `🎓 Attendance is now open for ${courseTitle} (${courseCode}) on ${classDate}, ${classTime.start} – ${classTime.end}, created by ${displayName}. Mark in before the deadline!`,
          relatedId: newAttendance._id,
          relatedType: 'attendance',
          groupId,
          link: `/group/${groupId}/attendance/${newAttendance._id}`,
          io,
        });
      })
    );

    // ✅ Emit real-time socket event to the group room
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
        time: classTime,
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
        totalStudents: studentDocs.length,
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
        acc + a.studentRecords.filter((s) => s.status !== 'absent').length,
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
      marked: a.studentRecords.filter((s) => s.status !== 'absent').length,
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
        if (s.status === 'absent') studentStats[id].absences += 1;
        if (s.status === 'late') studentStats[id].lateMarks += 1;
        if (s.status !== 'absent') studentStats[id].presentCount += 1;
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
                  (s) => s.status !== 'absent'
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
      time = new Date(),
      location = {},
      mode = 'checkIn',
    } = req.body;
    const io = req.io;

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      throw createHttpError(404, 'Attendance session not found.', {
        code: 'ATTENDANCE_NOT_FOUND',
      });
    }

    if (attendance.status !== 'active') {
      throw createHttpError(403, 'Attendance is closed.', {
        code: 'ATTENDANCE_CLOSED',
      });
    }

    const studentRecord = await StudentAttendance.findOne({
      attendanceId,
      studentId: userId,
    });

    if (!studentRecord) {
      throw createHttpError(
        403,
        'You are not allowed to mark this attendance.',
        {
          code: 'NOT_ALLOWED_TO_MARK',
        }
      );
    }

    const markTime = new Date(time);
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

    let wasWithinRange = true;
    let distanceFromClassMeters = null;

    if (
      method === 'geo' &&
      attendance.location?.latitude &&
      location.latitude
    ) {
      const { distanceMeters, isWithinRange } = validateGeoProximity(
        location,
        attendance.location
      );
      wasWithinRange = isWithinRange;
      distanceFromClassMeters = distanceMeters;
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown device';

    if (mode === 'checkIn') {
      if (studentRecord.checkIn?.time) {
        throw createHttpError(409, 'You have already marked check-in.', {
          code: 'ALREADY_CHECKED_IN',
          checkInTime: studentRecord.checkIn.time,
        });
      }

      const arrivalDeltaMinutes = Math.floor((markTime - classStart) / 60000);

      studentRecord.checkIn = {
        time: markTime,
        method,
        location,
        distanceFromClassMeters,
      };
      studentRecord.arrivalDeltaMinutes = arrivalDeltaMinutes;
      studentRecord.wasWithinRange = wasWithinRange;
      studentRecord.checkInVerified = method === 'geo' ? wasWithinRange : false;
      studentRecord.status = arrivalDeltaMinutes <= 0 ? 'on_time' : 'late';
      studentRecord.markedBy = 'student';
      studentRecord.deviceInfo = { ip, userAgent, markedAt: new Date() };

      const flagReasons = [];

      if (markTime < entryStart || markTime > entryEnd) {
        flagReasons.push('outside_marking_window');
      }
      if (method === 'geo' && !wasWithinRange) {
        flagReasons.push('location_mismatch');
      }
      if (method === 'geo' && !location.latitude) {
        flagReasons.push('geo_disabled');
      }

      const isFlagged = flagReasons.length > 0;
      studentRecord.flagged = {
        isFlagged,
        reasons: flagReasons,
        flaggedAt: isFlagged ? new Date() : undefined,
        flaggedBy: isFlagged ? req.user._id : undefined,
        note: isFlagged ? 'Auto-flagged based on trust rules.' : '',
      };

      await studentRecord.save();

      // Update Attendance summary
      if (studentRecord.status === 'on_time') {
        attendance.summaryStats.onTime += 1;
      } else if (studentRecord.status === 'late') {
        attendance.summaryStats.late += 1;
      }
      attendance.summaryStats.totalPresent += 1;
      await attendance.save();

      io.to(attendance.groupId.toString()).emit('attendance:progress', {
        attendanceId: attendance._id,
        studentId: studentRecord.studentId,
        studentName: studentRecord.name,
        status: studentRecord.status,
        summaryStats: attendance.summaryStats,
      });

      // Notify Rep if flagged
      if (isFlagged) {
        const group = await Group.findById(attendance.groupId).select(
          'createdBy'
        );
        if (group?.createdBy) {
          await sendNotification({
            type: 'info',
            message: `${studentRecord.name || 'A student'} was flagged during check-in: ${flagReasons.join(', ')}`,
            forUser: group.createdBy,
            fromUser: userId,
            groupId: group._id,
            relatedId: attendance._id,
            relatedType: 'attendance',
            link: `/group/${group._id}/attendance/${attendance._id}`,
            io: req.io,
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Check-in successful.',
        checkInTime: markTime,
        arrivalDeltaMinutes,
        distanceFromClassMeters,
        wasWithinRange,
        status: studentRecord.status,
        flagged: studentRecord.flagged,
      });
    }

    // ─── Check-Out ───
    if (mode === 'checkOut') {
      if (!studentRecord.checkIn?.time) {
        throw createHttpError(403, 'You must check in before checking out.', {
          code: 'CHECK_IN_REQUIRED',
        });
      }
      if (studentRecord.checkOut?.time) {
        throw createHttpError(409, 'You have already marked check-out.', {
          code: 'ALREADY_CHECKED_OUT',
          checkOutTime: studentRecord.checkOut.time,
        });
      }

      const departureDeltaMinutes = Math.floor((classEnd - markTime) / 60000);
      const durationMinutes = Math.floor(
        (markTime - new Date(studentRecord.checkIn.time)) / 60000
      );

      studentRecord.checkOut = {
        time: markTime,
        method,
        location,
        distanceFromClassMeters,
      };
      studentRecord.departureDeltaMinutes = departureDeltaMinutes;
      studentRecord.durationMinutes = durationMinutes;

      if (departureDeltaMinutes > 10) {
        studentRecord.status = 'left_early';
        attendance.summaryStats.leftEarly += 1;
      }

      await studentRecord.save();
      await attendance.save();

      // 🔥 EMIT SOCKET EVENT HERE
      req.io.to(attendance.groupId.toString()).emit('attendance:progress', {
        attendanceId: attendance._id,
        studentId: studentRecord.studentId,
        studentName: studentRecord.name,
        status: studentRecord.status,
        summaryStats: attendance.summaryStats,
      });

      return res.status(200).json({
        success: true,
        message: 'Check-out successful.',
        checkOutTime: markTime,
        durationMinutes,
        departureDeltaMinutes,
        distanceFromClassMeters,
        status: studentRecord.status,
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
      if (!record.status || record.status === 'absent') {
        absents++;
        await StudentAttendance.findByIdAndUpdate(record._id, {
          status: 'absent',
        });
      } else {
        totalPresent++;
        if (record.status === 'on_time') onTime++;
        else if (record.status === 'late') late++;
        else if (record.status === 'left_early') leftEarly++;
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

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(attendanceId)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_ATTENDANCE_ID',
        message: 'The provided attendanceId is not a valid MongoDB ObjectId.',
      });
    }

    // Find the attendance session
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

    // Delete the attendance session
    await Attendance.findByIdAndDelete(attendanceId);

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

    // Optional: disallow reopening sessions older than X days (e.g. audit control)
    const classDate = new Date(session.classDate);
    const daysSince =
      (Date.now() - classDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > 5)
      return res.status(403).json({
        success: false,
        code: 'OLD_SESSION',
        message: 'Cannot reopen old sessions.',
      });

    session.status = 'active';
    await session.save();

    const group = await Group.findById(session.groupId);
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

    io?.to(session.groupId.toString()).emit('group-notification', {
      type: 'announcement',
      title: 'Attendance Reopened',
      message: `${session.courseCode} - ${session.courseTitle} on ${session.classDate} is reopened. You can check in.`,
      relatedId: session._id,
      relatedType: 'attendance',
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
