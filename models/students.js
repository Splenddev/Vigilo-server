import mongoose from 'mongoose';
import User from './userModel.js';

const studentSchema = new mongoose.Schema({
  department: { type: String, required: true },
  faculty: { type: String, required: true },
  level: { type: String, required: true },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    default: null, // allow null initially
  },
  attendanceHistory: [
    {
      attendance: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Attendance',
      },
      status: {
        type: String,
        enum: ['present', 'absent', 'excused'],
      },
      timestamp: Date,
    },
  ],
});

const Student =
  mongoose.models.Student || User.discriminator('student', studentSchema);
export default Student;
