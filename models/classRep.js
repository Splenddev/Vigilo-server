import mongoose from 'mongoose';
import User from './userModel.js';

// Embedded Lecturer schema
const lecturerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
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

// Extend courses schema (already defined in User)
const extendedCourseSchema = new mongoose.Schema(
  {
    courseCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      match: /^[A-Z]{3}\d{3}$/, // Example: CSC201
    },
    courseTitle: { type: String, trim: true },
    unit: { type: Number, min: 1, max: 6 },
    lecturer: {
      type: lecturerSchema,
      required: true,
    },
  },
  { _id: false }
);

// ClassRep-specific fields
const classRepSchema = new mongoose.Schema({
  department: { type: String, required: true },
  faculty: { type: String, required: true },
  level: { type: String, required: true },

  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    default: null,
  },

  courses: {
    type: [extendedCourseSchema],
    validate: {
      validator: function (courses) {
        const codes = courses.map((c) => c.courseCode);
        return codes.length === new Set(codes).size;
      },
      message: 'Duplicate course codes are not allowed.',
    },
  },
});

const ClassRep =
  mongoose.models.ClassRep || User.discriminator('class-rep', classRepSchema);

export default ClassRep;
