import User from '../models/userModel.js';
import { createClassRep } from '../services/createClassRep.js';
import { createStudent } from '../services/createStudent.js';
import { createToken } from '../utils/createToken.js';
import bcrypt from 'bcryptjs';
import { generateOtp } from '../utils/generateOtp.js';
import { sendOtpEmail } from '../utils/sendOtp.js';
import { errorResponse } from '../utils/errorResponses.js';

export const register = async (req, res) => {
  const { role, courses, ...userData } = req.body;
  const profilePicture = req.file?.path || '';
  const normalizedRole = role?.toLowerCase();

  let parsedCourses = [];

  if (!role) {
    return errorResponse(res, 'MISSING_ROLE', 'Role is required.', 400);
  }

  if (typeof courses === 'string') {
    try {
      parsedCourses = JSON.parse(courses);
    } catch {
      return errorResponse(
        res,
        'INVALID_COURSES_JSON',
        'Invalid courses format passed.',
        400
      );
    }
  }

  try {
    const existing = await User.findOne({
      $or: [{ email: userData.email }, { username: userData.username }],
    });

    if (existing) {
      return errorResponse(
        res,
        'DUPLICATE_USER',
        'Email or username already in use.',
        400
      );
    }

    let user;

    if (normalizedRole === 'student') {
      user = await createStudent(userData, profilePicture);
    } else if (normalizedRole === 'class-rep') {
      if (!parsedCourses || parsedCourses.length < 3) {
        return errorResponse(
          res,
          'MIN_COURSE_REQUIREMENT',
          'Class reps must add at least 3 valid courses.',
          400
        );
      }
      user = await createClassRep(userData, profilePicture, parsedCourses);
    } else {
      return errorResponse(res, 'INVALID_ROLE', 'Invalid role provided.', 400);
    }

    await createToken(user._id, res);

    return res.status(201).json({
      message: `${normalizedRole === 'student' ? 'Student' : 'ClassRep'} account created`,
      success: true,
    });
  } catch (err) {
    console.error(err);
    return errorResponse(
      res,
      err.code || 'REGISTRATION_FAILED',
      err.message || 'Registration failed.',
      err.status || 400
    );
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
    sameSite: 'none',
  });

  res.status(200).json({ success: true, message: 'Logged out successfully' });
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
    await user.save({ validateBeforeSave: false });

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
    console.log(err);
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

export const getCurrentUser = async (req, res) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: 'Not authenticated' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }
    const {
      password: _,
      verifyOtp,
      verifyOtpExpirationTime,
      ...safeUser
    } = user.toObject();
    res.status(200).json({ success: true, user: safeUser });
  } catch (error) {
    console.error('Error fetching user:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
