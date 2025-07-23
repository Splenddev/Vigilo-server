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
    end: {
      type: String,
      validate: {
        validator: function (value) {
          const parse = (t) => {
            if (!t || typeof t !== 'string' || !t.includes(':')) return null;
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
          };

          const start = this?.classTime?.start;
          const end = value;

          const startMins = parse(start);
          const endMins = parse(end);

          if (startMins === null || endMins === null) return false;

          return endMins - startMins >= 30;
        },
        message: 'Class duration must be at least 30 minutes.',
      },
    },
  },

  entry: {
    start: { type: String, default: '0H10M' },
    end: { type: String, default: '1H30M' },
  },

  initialized: {
    type: Boolean,
    default: false,
  },

  reopened: {
    type: Boolean,
    default: false,
  },

  reopenDuration: {
    type: String,
    default: '0H30M',
  },

  reopenAllowedStudents: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],

  reopenedUntil: {
    type: Date,
    default: null,
  },

  attendanceType: {
    type: String,
    enum: ['physical', 'virtual'],
    default: 'physical',
  },

  settings: {
    markOnce: { type: Boolean, default: true },
    allowLateJoiners: { type: Boolean, default: true },
    lateThreshold: { type: Number, default: 10 },
    pleaWindowDays: { type: Number, default: 3 },
    proofRequirement: {
      type: String,
      enum: ['none', 'selfie', 'fingerprint'],
      default: 'none',
    },

    enableCheckInOut: { type: Boolean, default: false },
    allowEarlyCheckIn: { type: Boolean, default: false },
    allowLateCheckOut: { type: Boolean, default: true },
    allowLateCheckIn: { type: Boolean, default: false },
    allowEarlyCheckOut: { type: Boolean, default: true },
    minimumPresenceDuration: { type: Number, default: 45 },
    autoCheckOut: { type: Boolean, default: true },

    repeatable: { type: Boolean, default: false },
    notifyOnStart: { type: Boolean, default: true },

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
  },

  location: {
    latitude: Number,
    longitude: Number,
    radiusMeters: {
      type: Number,
      default: 30,
    },
  },

  status: {
    type: String,
    enum: ['active', 'closed', 'upcoming'],
    default: 'active',
  },

  autoEnd: {
    type: Boolean,
    default: true,
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

attendanceSchema.set('toObject', { virtuals: true });
attendanceSchema.set('toJSON', { virtuals: true });

attendanceSchema.virtual('studentRecords', {
  ref: 'StudentAttendance',
  localField: '_id',
  foreignField: 'attendanceId',
});

attendanceSchema.index(
  { scheduleId: 1, classDate: 1, 'classTime.start': 1 },
  { unique: true, sparse: true }
);

const Attendance =
  mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);

export default Attendance;
