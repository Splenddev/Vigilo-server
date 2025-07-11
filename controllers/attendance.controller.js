import mongoose from 'mongoose';
import Attendance from '../models/attendance.model.js';
import Group from '../models/group.js';
import scheduleModel from '../models/schedule.model.js';
import { generateAttendanceId } from '../utils/idGenerator.js';
import createHttpError from 'http-errors';
import { validateGeoProximity } from '../utils/geoUtils.js';

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

    // 1️⃣ Validate required fields
    const missing = [];
    if (!groupId) missing.push('groupId');
    if (!classDate) missing.push('classDate');
    if (!classTime) missing.push('classTime');
    if (!location) missing.push('location');

    if (missing.length) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_FIELDS',
        message: `Missing required field(s): ${missing.join(', ')}.`,
      });
    }

    // 2️⃣ Validate classTime values
    const [startHour, startMin] = classTime.start.split(':').map(Number);
    const [endHour, endMin] = classTime.end.split(':').map(Number);
    const startDate = new Date(2000, 1, 1, startHour, startMin);
    const endDate = new Date(2000, 1, 1, endHour, endMin);

    if (endDate <= startDate) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_TIME_RANGE',
        message: 'Class end time must be later than start time.',
      });
    }

    // 3️⃣ Validate entry time window
    if (entry?.start && entry?.end) {
      const toMinutes = (str) => {
        if (str === 'FULL') {
          const [startH, startM] = classTime.start.split(':').map(Number);
          const [endH, endM] = classTime.end.split(':').map(Number);
          const start = new Date(0, 0, 0, startH, startM);
          const end = new Date(0, 0, 0, endH, endM);
          const diffMins = Math.floor((end - start) / (1000 * 60));
          return diffMins;
        }

        const match = str.match(/(\d+)H(\d+)M/);
        if (!match) return null;
        return parseInt(match[1]) * 60 + parseInt(match[2]);
      };

      const entryStartMins = toMinutes(entry.start);
      const entryEndMins = toMinutes(entry.end);

      if (
        entryStartMins === null ||
        entryEndMins === null ||
        entryEndMins <= entryStartMins
      ) {
        throw createHttpError(
          400,
          'Marking end must be after start, in valid H and M format.',
          {
            code: 'INVALID_ENTRY_WINDOW',
          }
        );
      }
    }

    // 4️⃣ Validate location
    if (
      typeof location.latitude !== 'number' ||
      typeof location.longitude !== 'number' ||
      isNaN(location.latitude) ||
      isNaN(location.longitude)
    ) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_LOCATION',
        message: 'Latitude and longitude must be valid numbers.',
      });
    }

    // 5️⃣ Prevent duplicate session for same schedule + time
    const existing = await Attendance.findOne({
      scheduleId,
      courseCode,
      courseTitle,
      classDate,
      'classTime.start': classTime.start,
    });

    if (existing) {
      throw createHttpError(
        409,
        'Attendance already exists for this schedule on 2025-07-11 at 08:00.',
        {
          code: 'ATTENDANCE_EXISTS',
          attendanceId: 'att_123456',
        }
      );
    }

    // 6️⃣ Fetch group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        code: 'GROUP_NOT_FOUND',
        message: `No group found with ID "${groupId}".`,
      });
    }

    const studentRecords = group.members.map((s) => ({
      studentId: s._id,
      name: s.name,
      status: 'absent',
      role: s.role,
    }));

    // 7️⃣ Optionally validate schedule
    const schedule = scheduleId
      ? await scheduleModel.findById(scheduleId)
      : null;

    if (scheduleId && !schedule) {
      return res.status(404).json({
        success: false,
        code: 'SCHEDULE_NOT_FOUND',
        message: `No schedule found with ID "${scheduleId}".`,
      });
    }

    // 8️⃣ Generate unique attendance ID using daily count
    const todaysCount = await Attendance.countDocuments({ groupId, classDate });
    const counter = todaysCount + 1;
    const attendanceId = generateAttendanceId(groupId, classDate, counter);

    // 9️⃣ Create the attendance
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
        name: schedule?.lecturer?.name || lecturer.name,
        email: schedule?.lecturer?.email || lecturer.name || '',
      },
      studentRecords,
    });

    // 🔟 Respond
    return res.status(201).json({
      success: true,
      message: `Attendance session ${attendanceId} created successfully by ${createdByName}.`,
      attendance: {
        id: newAttendance._id,
        attendanceId: newAttendance.attendanceId,
        groupId: newAttendance.groupId,
        classDate: newAttendance.classDate,
        status: newAttendance.status,
        totalStudents: studentRecords.length,
        createdAt: newAttendance.createdAt,
      },
    });
  } catch (err) {
    console.error('❌ Error creating attendance:', err);
    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: 'An unexpected server error occurred while creating attendance.',
      error: err.message,
    });
  }
};

export const getGroupAttendances = async (req, res) => {
  const { groupId } = req.params;

  try {
    if (!groupId) {
      return res.status(400).json({ message: 'Group ID is required.' });
    }

    const attendances = await Attendance.find({ groupId }).sort({
      classDate: 1,
    });

    res.json({ attendances });
  } catch (error) {
    console.error('Error fetching group attendances:', error.message);
    res
      .status(500)
      .json({ message: 'Failed to fetch attendances.', error: error.message });
  }
};

export const getGroupAttendanceTab = async (req, res) => {
  try {
    const { groupId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_GROUP_ID',
        message: 'The provided groupId is not a valid MongoDB ObjectId.',
      });
    }

    const attendances = await Attendance.find({ groupId }).sort({
      classDate: -1,
    });

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

    // Helper: check if session has closed
    const isEntryClosed = (attendance) => {
      const end = new Date(attendance.classTime?.end).getTime();
      return !isNaN(end) && end <= now;
    };

    const activeSession = attendances.find((a) => a.status === 'active');

    // Compute totals for summary only from closed sessions
    const closedAttendances = attendances.filter(isEntryClosed);

    const totalSessions = closedAttendances.length;
    const totalMarked = closedAttendances.reduce(
      (sum, a) =>
        sum + a.studentRecords.filter((s) => s.status !== 'absent').length,
      0
    );
    const totalStudents = closedAttendances.reduce(
      (sum, a) => sum + a.studentRecords.length,
      0
    );
    const avgAttendanceRate =
      totalStudents > 0 ? ((totalMarked / totalStudents) * 100).toFixed(1) : 0;

    const recentSessions = attendances.slice(0, 5).map((a) => {
      const entryClosed = isEntryClosed(a);
      return {
        attendanceId: a.attendanceId,
        date: a.classDate,
        topic: a.courseTitle || 'Untitled',
        marked: a.studentRecords.filter((s) => s.status !== 'absent').length,
        late: entryClosed ? a.summaryStats?.late || 0 : 0,
        absent: entryClosed ? a.summaryStats?.absent || 0 : 0,
      };
    });

    const studentAbsenceMap = {};
    closedAttendances.forEach((a) => {
      a.studentRecords.forEach((s) => {
        const id = s.studentId.toString();
        if (!studentAbsenceMap[id]) {
          studentAbsenceMap[id] = {
            studentId: id,
            name: s.name,
            absences: 0,
            lateMarks: 0,
            attendanceCount: 0,
            presentCount: 0,
          };
        }
        if (s.status === 'absent') studentAbsenceMap[id].absences += 1;
        if (s.status === 'late') studentAbsenceMap[id].lateMarks += 1;
        if (s.status !== 'absent') studentAbsenceMap[id].presentCount += 1;
        studentAbsenceMap[id].attendanceCount += 1;
      });
    });

    const topAbsentees = Object.values(studentAbsenceMap)
      .map((s) => ({
        studentId: s.studentId,
        name: s.name,
        absences: s.absences,
        lateMarks: s.lateMarks,
        attendanceRate:
          s.attendanceCount > 0
            ? ((s.presentCount / s.attendanceCount) * 100).toFixed(1)
            : 0,
      }))
      .filter((s) => s.absences > 0)
      .sort((a, b) => b.absences - a.absences)
      .slice(0, 5);

    const pleaRequests = [];
    closedAttendances.forEach((a) => {
      a.studentRecords.forEach((s) => {
        if (s.plea?.status === 'pending') {
          pleaRequests.push({
            pleaId: `${a._id}-${s.studentId}`,
            studentId: s.studentId,
            name: s.name,
            date: a.classDate,
            reason: s.plea.reasons?.[0],
            proofUrl: s.plea.proofUpload?.fileUrl,
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
          avgAttendanceRate: Number(avgAttendanceRate),
          totalMarked,
          totalAbsent: totalStudents - totalMarked,
          activeSession: activeSession
            ? {
                isActive: true,
                attendanceId: activeSession.attendanceId,
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
      message: 'Something went wrong while retrieving attendance data.',
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

    const studentRecord = attendance.studentRecords.find((r) =>
      r.studentId.equals(userId)
    );

    if (!studentRecord) {
      throw createHttpError(403, 'You are not in the allowed student list.', {
        code: 'NOT_ALLOWED_TO_MARK',
      });
    }

    const markTime = new Date(time);
    const classStart = new Date(
      `${attendance.classDate}T${attendance.classTime.start}`
    );
    const classEnd = new Date(
      `${attendance.classDate}T${attendance.classTime.end}`
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

      attendance.summaryStats.totalPresent += 1;
      if (studentRecord.status === 'on_time')
        attendance.summaryStats.onTime += 1;
      if (studentRecord.status === 'late') attendance.summaryStats.late += 1;

      await attendance.save();

      return res.status(200).json({
        success: true,
        message: 'Check-in successful.',
        checkInTime: markTime,
        arrivalDeltaMinutes,
        distanceFromClassMeters,
        wasWithinRange,
        status: studentRecord.status,
      });
    }

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

      await attendance.save();

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
