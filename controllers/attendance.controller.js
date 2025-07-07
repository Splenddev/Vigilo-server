import Attendance from '../models/attendance.model.js';
import Group from '../models/group.js';
import scheduleModel from '../models/schedule.model.js';
import { generateAttendanceId } from '../utils/idGenerator.js';

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
        return res.status(400).json({
          success: false,
          code: 'INVALID_ENTRY_WINDOW',
          message: 'Marking end must be after start, in valid H and M format.',
        });
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
      classDate,
      'classTime.start': classTime.start,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        code: 'ATTENDANCE_EXISTS',
        message: `Attendance already exists for this schedule on ${classDate} at ${classTime.start}.`,
        attendanceId: existing.attendanceId,
      });
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
      name: s.fullName,
      status: 'absent',
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
      classTime,
      entry,
      location,
      attendanceType: attendanceType || 'physical',
      markingConfig,
      createdBy,
      lecturer: {
        name: schedule?.lecturer?.name || '',
        email: schedule?.lecturer?.email || '',
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
