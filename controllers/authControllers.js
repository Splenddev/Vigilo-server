import User from '../models/userModel.js';
import { createClassRep } from '../utils/createClassRep.js';
import { createStudent } from '../utils/createStudent.js';
import { createToken } from '../utils/createToken.js';
import bcrypt from 'bcryptjs';

export const register = async (req, res) => {
  const { role, ...userData } = req.body;
  const profilePicture = req.file?.path || null; // Cloudinary URL

  if (!role) {
    return res.status(400).json({ message: 'Role is required.' });
  }

  try {
    let user;

    if (role === 'student') {
      user = await createStudent(userData, profilePicture);
    } else if (role === 'class-rep') {
      user = await createClassRep(userData, profilePicture);
    } else {
      return res.status(400).json({ message: 'Invalid role provided.' });
    }

    createToken(user._id, res);

    res.status(201).json({
      message: `${role === 'student' ? 'Student' : 'ClassRep'} account created`,
      user,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
};

export const login = async (req, res) => {
  const { password, identifier } = req.body;
  console.log(`pass: ${password} username: ${identifier}`);
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

    createToken(user._id, res);

    return res.status(200).json({
      user,
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
