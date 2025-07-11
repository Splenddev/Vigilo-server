import mongoose from 'mongoose';

// ─── Student Record ───
const studentRecordSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: String,

    status: {
      type: String,
      enum: ['on_time', 'late', 'left_early', 'absent', 'excused'],
      default: 'absent',
    },

    checkIn: {
      time: Date,
      method: { type: String, enum: ['geo', 'manual'], default: 'geo' },
      location: {
        latitude: Number,
        longitude: Number,
      },
      distanceFromClassMeters: Number,
    },

    checkOut: {
      time: Date,
      method: { type: String, enum: ['geo', 'manual'], default: 'geo' },
      location: {
        latitude: Number,
        longitude: Number,
      },
      distanceFromClassMeters: Number,
    },

    arrivalDeltaMinutes: Number,
    departureDeltaMinutes: Number,
    durationMinutes: Number,

    wasWithinRange: Boolean,
    checkInVerified: Boolean,
    markedBy: {
      type: String,
      enum: ['student', 'rep', 'system'],
    },

    warningsIssued: { type: Number, default: 0 },
    penaltyPoints: { type: Number, default: 0 },
    rewardPoints: { type: Number, default: 0 },

    verifiedByRep: { type: Boolean, default: false },
    notes: String,

    flagged: {
      isFlagged: { type: Boolean, default: false },
      reasons: [
        {
          type: String,
          enum: [
            'location_mismatch',
            'manual_override',
            'suspicious_timing',
            'repeat_offender',
            'proof_needed',
            'fake_location',
            'geo_disabled',
            'outside_marking_window',
            'other',
            'joined_after_attendance_created',
          ],
        },
      ],
      note: String,
      flaggedAt: Date,
      flaggedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    },

    plea: {
      message: String,
      reasons: [
        {
          type: String,
          enum: [
            'C - Conference / Official Duty',
            'E - Excused',
            'F - Family Emergency',
            'M - Medical',
            'O - Others (Specify)',
            'P - Personal Reasons',
            'R - Religious Observance',
            'S - Suspension',
            'T - Travel',
          ],
        },
      ],
      proofUpload: {
        fileName: String,
        fileUrl: String,
      },
      submittedAt: Date,
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
      },
      reviewedAt: Date,
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      reviewerNote: String,
    },
  },
  { _id: false }
);

// ─── Attendance Schema ───
const attendanceSchema = new mongoose.Schema({
  attendanceId: { type: String, unique: true, required: true },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
  },

  courseCode: { type: String, required: true },
  courseTitle: { type: String, required: true },
  lecturer: {
    name: { type: String, required: true },
    email: String,
  },
  scheduleRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Schedule' },

  classDate: { type: String, required: true },
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
  createdAt: { type: Date, default: Date.now },

  studentRecords: {
    type: [studentRecordSchema],
    default: [],
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

attendanceSchema.index(
  { scheduleId: 1, classDate: 1, 'classTime.start': 1 },
  { unique: true, sparse: true }
);

const Attendance =
  mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);

export default Attendance;
