import mongoose from 'mongoose';

const studentAttendanceSchema = new mongoose.Schema(
  {
    attendanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attendance',
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: String,

    // Separated statuses
    checkInStatus: {
      type: String,
      enum: ['on_time', 'late', 'missed', 'absent'],
      default: 'absent',
    },
    checkOutStatus: {
      type: String,
      enum: ['on_time', 'left_early', 'missed'],
      default: 'missed',
    },

    // Optional: Final status (can be computed dynamically too)
    finalStatus: {
      type: String,
      enum: ['present', 'partial', 'absent', 'excused'],
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

    deviceInfo: {
      ip: String,
      userAgent: String,
      markedAt: Date,
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
          type: {
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
              'joined_after_attendance_created',
              'other',
            ],
          },
          severity: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'medium',
          },
          detectedBy: {
            type: String,
            enum: ['system', 'rep'],
            default: 'system',
          },
          note: String,
        },
      ],
      flaggedAt: Date,
      flaggedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      status: {
        type: String,
        enum: ['active', 'dismissed'],
        default: 'active',
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
  {
    timestamps: true,
  }
);

// Unique index to prevent multiple records for same attendance-student pair
studentAttendanceSchema.index(
  { attendanceId: 1, studentId: 1 },
  { unique: true }
);

const StudentAttendance =
  mongoose.models.StudentAttendance ||
  mongoose.model('StudentAttendance', studentAttendanceSchema);

export default StudentAttendance;
