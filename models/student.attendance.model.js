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

    deviceInfo: {
      ip: String,
      userAgent: String,
      markedAt: Date,
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
              'other',
              'joined_after_attendance_created',
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

studentAttendanceSchema.index(
  { attendanceId: 1, studentId: 1 },
  { unique: true }
);

const StudentAttendance =
  mongoose.models.StudentAttendance ||
  mongoose.model('StudentAttendance', studentAttendanceSchema);

export default StudentAttendance;
