import User from '../models/userModel.js';
import { createClassRep } from '../utils/createClassRep.js';
import { createStudent } from '../utils/createStudent.js';
import { createToken } from '../utils/createToken.js';
import bcrypt from 'bcryptjs';
import { generateOtp } from '../utils/generateOtp.js';
import { sendOtpEmail } from '../utils/sendOtp.js';

export const register = async (req, res) => {
  const { role, ...userData } = req.body;
  const profilePicture = req.file?.path || null;

  if (!role) {
    return res.status(400).json({ message: 'Role is required.' });
  }

  const normalizedRole = role.toLowerCase();

  try {
    // Optional duplicate check
    const existing = await User.findOne({
      $or: [{ email: userData.email }, { username: userData.username }],
    });
    if (existing) {
      return res
        .status(400)
        .json({ message: 'Email or username already in use.' });
    }

    let user;
    if (normalizedRole === 'student') {
      user = await createStudent(userData, profilePicture);
    } else if (normalizedRole === 'class-rep') {
      user = await createClassRep(userData, profilePicture);
    } else {
      return res.status(400).json({ message: 'Invalid role provided.' });
    }

    await createToken(user._id, res);

    res.status(201).json({
      message: `${normalizedRole === 'student' ? 'Student' : 'ClassRep'} account created`,
      success: true,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
};

export const login = async (req, res) => {
  const { password, identifier } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email/username and password are required.',
    });
  }

  try {
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    const passwordIsMatch = await bcrypt.compare(password, user.password);
    if (!passwordIsMatch) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password.',
      });
    }

    await createToken(user._id, res);

    const {
      password: _,
      verifyOtp,
      verifyOtpExpirationTime,
      ...safeUser
    } = user.toObject();

    return res.status(200).json({
      user: safeUser,
      message: 'You are logged in successfully',
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server Error!',
    });
  }
};

export const logoutUser = (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
  });

  res.status(200).json({ message: 'Logged out successfully' });
};

export const sendOtp = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });

    const otp = generateOtp();
    const expiration = Date.now() + 10 * 60 * 1000; // 10 minutes

    user.verifyOtp = otp;
    user.verifyOtpExpirationTime = expiration;
    await user.save();

    const emailResult = await sendOtpEmail({
      to: user.email,
      name: user.name,
      otp,
    });

    if (!emailResult.success) {
      return res
        .status(500)
        .json({ success: false, message: 'Failed to send OTP email' });
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔐 OTP sent to ${user.email}: ${otp}`);
    }

    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });

    const isValidOtp =
      user.verifyOtp === otp && Date.now() <= user.verifyOtpExpirationTime;

    if (!isValidOtp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP',
      });
    }

    user.isEmailVerified = true;
    user.verifyOtp = '';
    user.verifyOtpExpirationTime = 0;
    await user.save();

    res.json({ success: true, message: 'OTP verified successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
