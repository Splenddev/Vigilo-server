// models/User.js
import mongoose from 'mongoose';

const options = {
  discriminatorKey: 'role', // this enables role-based model extension
  timestamps: true,
};

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    matricNumber: { type: String, required: true, unique: true },

    email: { type: String, required: true, unique: true },

    password: { type: String, required: true },

    username: { type: String, required: true, unique: true },

    profilePicture: { type: String, default: null },

    verifyOtp: { type: String, default: '' },

    verifyOtpExpirationTime: { type: Number, default: 0 },

    isEmailVerified: { type: Boolean, default: false },

    resetPasswordOtp: { type: String, default: '' },

    resetPasswordOtpExpirationTime: { type: Number, default: 0 },

    requestedJoinGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      default: null,
    },
    role: { type: String, enum: ['class-rep', 'student'], required: true },

    // ✅ Add this line:
    isNewUser: { type: Boolean, default: true },
  },
  options
);

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
