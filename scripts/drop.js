import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Attendance from '../models/attendance.model.js';
import StudentAttendance from '../models/student.attendance.model.js';

dotenv.config(); // Load environment variables from .env

const cleanupOrphanedStudentAttendance = async () => {
  console.log(process.env.MONGO_URI);
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('📡 Connected to MongoDB');

    const validIds = await Attendance.distinct('_id');

    const result = await StudentAttendance.deleteMany({
      attendanceId: { $nin: validIds },
    });

    console.log(
      `✅ Deleted ${result.deletedCount} orphaned student attendance records.`
    );
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

cleanupOrphanedStudentAttendance();
