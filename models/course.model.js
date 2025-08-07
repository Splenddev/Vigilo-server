import mongoose from 'mongoose';

const lecturerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: /^\S+@\S+\.\S+$/,
    },
  },
  { _id: false }
);

const courseSchema = new mongoose.Schema(
  {
    courseCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      match: /^[A-Z]{3}\d{3}$/,
    },
    courseTitle: {
      type: String,
      trim: true,
    },
    unit: {
      type: Number,
      min: 1,
      max: 6,
    },
    instructor: {
      type: lecturerSchema,
      required: true,
    },

    description: {
      type: String,
      trim: true,
    },

    level: {
      type: String,
      required: true,
      trim: true,
    },

    department: {
      type: String,
      required: true,
      trim: true,
    },

    faculty: {
      type: String,
      required: true,
      trim: true,
    },

    thumbnail: {
      type: String,
      trim: true,
    },

    tags: {
      type: [String],
      default: [],
    },

    // Smart scheduling-related fields
    durationWeeks: {
      type: Number,
      min: 1,
      required: true,
    },

    classesPerWeek: {
      type: Number,
      min: 1,
      default: 1,
    },

    expectedSchedules: {
      type: Number,
      default: 0,
      min: 0,
    },

    completedSchedules: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Progress tracking
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    hoursSpent: {
      type: Number,
      min: 0,
      default: 0,
    },

    estimatedHours: {
      type: Number,
      min: 1,
      default: 30,
    },

    completed: {
      type: Boolean,
      default: false,
    },

    startedAt: {
      type: Date,
      default: Date.now,
    },

    completedAt: {
      type: Date,
    },

    // Ownership and linkage
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Course = mongoose.models.Course || mongoose.model('Course', courseSchema);
export default Course;
