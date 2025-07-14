import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  attendanceId: {
    type: String,
    unique: true,
    required: true,
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
  },

  courseCode: {
    type: String,
    required: true,
  },
  courseTitle: {
    type: String,
    required: true,
  },
  lecturer: {
    name: { type: String, required: true },
    email: String,
  },
  scheduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Schedule',
  },

  classDate: {
    type: String,
    required: true,
  },
  classTime: {
    day: {
      type: String,
      enum: [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ],
    },
    start: String,
    end: String,
  },
  entry: {
    start: { type: String, default: '0H10M' },
    end: { type: String, default: '1H30M' },
  },
  attendanceType: {
    type: String,
    enum: ['physical', 'virtual'],
    default: 'physical',
  },
  markingConfig: {
    type: {
      type: String,
      enum: ['strict', 'detailed'],
      default: 'strict',
    },
    mode: {
      type: String,
      enum: ['code', 'no_code'],
      default: 'no_code',
    },
  },
  location: {
    latitude: Number,
    longitude: Number,
    radiusMeters: Number,
  },
  status: {
    type: String,
    enum: ['active', 'closed'],
    default: 'active',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },

  summaryStats: {
    totalPresent: { type: Number, default: 0 },
    onTime: { type: Number, default: 0 },
    late: { type: Number, default: 0 },
    leftEarly: { type: Number, default: 0 },
    absent: { type: Number, default: 0 },
    withPlea: { type: Number, default: 0 },
  },

  notes: String,
});

// ✅ Enable virtuals in JSON and object outputs
attendanceSchema.set('toObject', { virtuals: true });
attendanceSchema.set('toJSON', { virtuals: true });

// ✅ Reverse relationship: Attendance -> StudentAttendance
attendanceSchema.virtual('studentRecords', {
  ref: 'StudentAttendance',
  localField: '_id',
  foreignField: 'attendanceId',
});

// ✅ Unique index to prevent duplicates on same date/time
attendanceSchema.index(
  { scheduleId: 1, classDate: 1, 'classTime.start': 1 },
  { unique: true, sparse: true }
);

// ✅ Export
const Attendance =
  mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);

export default Attendance;
