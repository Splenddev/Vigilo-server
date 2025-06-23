import bcrypt from 'bcryptjs';
import Student from '../models/students.js';
import { SALT_ROUNDS } from './constants.js';

export const createStudent = async (data, profilePicture) => {
  const {
    name,
    email,
    password,
    username,
    matricNumber,
    department,
    faculty,
    level,
  } = data;

  const existing = await Student.findOne({
    $or: [{ email }, { username }, { matricNumber }],
  });
  if (existing)
    throw new Error('Email, username, or matric number already exists.');

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const newStudent = await Student.create({
    name,
    email,
    password: hashedPassword,
    username,
    role: 'student',
    matricNumber,
    group: null,
    profilePicture,
    department,
    faculty,
    level,
  });

  return newStudent;
};
