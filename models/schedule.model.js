import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const allowedExtensionsMap = {
  doc: ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'],
  image: ['.png', '.jpeg', '.webp'],
  video: ['.mp4', '.webm', '.avi'],
  audio: ['.mp3', '.aac', '.wav', '.wma'],
  link: [], // no extensions needed
};

// Schema for class timing (per day)
const classDayTimeSchema = new mongoose.Schema({
  day: {
    type: String,
    required: true,
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
  timing: {
    startTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/, // 24-hour format HH:mm
    },
    endTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },
  },
});

// Schema for media resources
const mediaSchema = new mongoose.Schema({
  id: {
    type: String,
    default: () => `media-${uuidv4().split('-')[0]}`,
  },
  fileType: {
    type: String,
    enum: ['pdf', 'video', 'image', 'link', 'audio', 'doc'],
    required: true,
  },
  allowedExt: {
    type: [String],
    default: [],
    validate: {
      validator: function (exts) {
        if (!this.fileType || !Array.isArray(exts)) return true;
        const allowed = allowedExtensionsMap[this.fileType] || [];
        return exts.every((ext) => allowed.includes(ext.toLowerCase()));
      },
      message: (props) =>
        `Some extensions in [${props.value}] are not valid for fileType "${props.fileType}".`,
    },
  },
  src: { type: String, required: true },
  name: { type: String, required: true },
  dateAdded: { type: String, required: true }, // 'YYYY-MM-DD'
  timeAdded: { type: String, required: true }, // e.g. '11:47 AM'
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now },
  approved: { type: Boolean, default: false },
});

// Main Schedule Schema
const scheduleSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
      index: true,
    },

    courseTitle: { type: String, required: true },
    courseCode: { type: String, required: true },
    lecturerName: { type: String, required: true },
    classroomVenue: { type: String, required: true },

    level: { type: String },
    department: { type: String },
    faculty: { type: String },

    classDaysTimes: {
      type: [classDayTimeSchema],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'At least one class day and timing is required.',
      },
    },

    media: [mediaSchema],

    attendanceRecords: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Attendance' },
    ],

    repeat: {
      type: String,
      enum: ['once', 'weekly', 'bi-weekly'],
      default: 'weekly',
    },

    isActive: { type: Boolean, default: true },
    allowAttendanceMarking: { type: Boolean, default: true },
    notificationLeadTime: {
      type: Number,
      min: 0,
      max: 1440,
      default: 30, // in minutes
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt fields
  }
);

scheduleSchema.virtual('nextClassTime').get(function () {
  return null;
});

export default mongoose.model('Schedule', scheduleSchema);
