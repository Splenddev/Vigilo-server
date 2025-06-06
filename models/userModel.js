// models/User.js
import mongoose from 'mongoose';

const options = {
  discriminatorKey: 'role', // this enables role-based model extension
  timestamps: true,
};

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    username: { type: String, required: true, unique: true },

    verifyOtp: { type: String, default: '' },
    verifyOtpExpirationTime: { type: Number, default: 0 },
    isEmailVerified: { type: Boolean, default: false },
    resetPasswordOtp: { type: String, default: '' },
    resetPasswordOtpExpirationTime: { type: Number, default: 0 },

    role: { type: String, enum: ['classRep', 'student'], required: true },
  },
  options
);

const userModel = mongoose.models.User || mongoose.model('User', userSchema);
export default userModel;
