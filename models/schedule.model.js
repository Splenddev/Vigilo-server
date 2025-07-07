//schedule.model.js

import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

// File extension validation map
const allowedExtensionsMap = {
  doc: ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'],
  image: ['.png', '.jpeg', '.webp', '.jpg'],
  video: ['.mp4', '.webm', '.avi'],
  audio: ['.mp3', '.aac', '.wav', '.wma'],
  link: [], // no extensions
};

// Schema: Class Day & Time
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
      match: /^([01]\d|2[0-3]):([0-5]\d)$/, // 24-hour format
    },
    endTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },
  },
});

// Schema: Media
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
        `Invalid extensions in [${props.value}] for fileType "${props.fileType}".`,
    },
  },
  src: { type: String, required: true },
  name: { type: String, required: true },
  dateAdded: { type: String, required: true }, // e.g. '2025-06-26',
  cloudinaryId: {
    // ➟ the public_id Cloudinary returns
    type: String,
    required: true,
  },
  resourceType: {
    // ➟ image | video | raw    (audio counts as video)
    type: String,
    enum: ['image', 'video', 'raw'],
    required: true,
  },
  timeAdded: { type: String, required: true }, // e.g. '11:45 AM'
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

    // Course & Lecturer Info
    courseTitle: { type: String, required: true },
    courseCode: { type: String, required: true },
    creditUnit: { type: String }, // optional
    lecturerName: { type: String, required: true },
    lecturerEmail: { type: String }, // optional

    // Class Details
    classroomVenue: { type: String, required: true },
    department: { type: String },
    faculty: { type: String },
    level: { type: String },
    classType: { type: String, enum: ['Physical', 'Virtual'] },
    virtualLink: { type: String },
    maxStudents: { type: Number },
    classLocation: {
      lat: { type: Number },
      lng: { type: Number },
    },

    // Class Days & Times
    classDaysTimes: {
      type: [classDayTimeSchema],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'At least one class day and timing is required.',
      },
    },

    // Optional Add-ons
    notes: { type: String },
    repeatPattern: {
      type: String,
      enum: ['once', 'weekly', 'bi-weekly', 'monthly'],
      default: 'weekly',
    },
    autoEnd: { type: Boolean, default: false },

    isActive: { type: Boolean, default: true },
    allowAttendanceMarking: { type: Boolean, default: true },
    notificationLeadTime: {
      type: Number,
      min: 0,
      max: 1440,
      default: 30, // in minutes
    },

    // Media
    media: [mediaSchema],
    allowMediaUploads: { type: Boolean, default: false },
    mediaNeedsApproval: { type: Boolean, default: false },

    // Attendance Records
    attendanceRecords: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Attendance' },
    ],

    // Audit
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual for next class preview
scheduleSchema.virtual('nextClassTime').get(function () {
  return null; // Optional logic here
});

const scheduleModel =
  mongoose.models.Schedule || mongoose.model('Schedule', scheduleSchema);
export default scheduleModel;
