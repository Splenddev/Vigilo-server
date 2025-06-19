import mongoose from 'mongoose';

const studentRecordSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Student role
      required: true,
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'excused'],
      default: 'absent',
    },
    markedAt: String, // optional time string, e.g., "09:08"
    location: {
      lat: Number,
      lng: Number,
      distanceFromClass: Number, // in meters
    },
    plea: {
      reason: String,
      proofUrl: String,
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
      },
      submittedAt: Date,
    },
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema({
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Class Rep
    required: true,
  },
  scheduleRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Schedule',
  },
  date: {
    type: String, // Format: "YYYY-MM-DD"
    required: true,
  },
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
  time: {
    start: String, // "08:00"
    end: String, // "10:00"
  },
  records: {
    type: [studentRecordSchema],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

attendanceSchema.index({ group: 1, date: 1 }, { unique: true });

const Attendance =
  mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);
export default Attendance;
